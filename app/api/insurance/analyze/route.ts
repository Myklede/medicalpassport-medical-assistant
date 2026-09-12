import { env } from 'cloudflare:workers';

import { getPatientContext, writeAudit } from '@/db/runtime';
import {
  analyzeCoverage,
  buildPolicyProfile,
  type NetworkStatus,
  type PolicyProfile,
} from '@/lib/insurance-analysis';

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function parseProfile(value: string, filename: string): PolicyProfile {
  try {
    const parsed = JSON.parse(value) as PolicyProfile;
    if (parsed?.version === 1 && parsed.rules && typeof parsed.deductible === 'number') return parsed;
  } catch {
    // A safe demo profile keeps the request recoverable if stored metadata is corrupt.
  }
  return buildPolicyProfile([], filename);
}

export async function POST(request: Request) {
  try {
    const context = await getPatientContext(request);
    const body = await request.json() as Record<string, unknown>;
    const documentId = text(body.document_id, 80);
    const condition = text(body.condition, 3000);
    const networkStatus = text(body.network_status, 30) as NetworkStatus;
    const rawCost = body.estimated_cost;
    const estimatedCost = rawCost === '' || rawCost === null || rawCost === undefined
      ? null
      : Number(rawCost);

    if (!documentId) return Response.json({ error: 'Vui lòng chọn một SBC đã lưu.' }, { status: 400 });
    if (condition.length < 5) return Response.json({ error: 'Hãy mô tả tình trạng và dịch vụ dự kiến rõ hơn.' }, { status: 400 });
    if (!['in-network', 'out-of-network', 'unknown'].includes(networkStatus)) {
      return Response.json({ error: 'Trạng thái network không hợp lệ.' }, { status: 400 });
    }
    if (estimatedCost !== null && (!Number.isFinite(estimatedCost) || estimatedCost <= 0 || estimatedCost > 100000)) {
      return Response.json({ error: 'Chi phí dự kiến phải lớn hơn 0 và không quá 100.000 USD.' }, { status: 400 });
    }

    const document = await env.DB.prepare(
      `SELECT d.id, d.benefits_json, s.original_filename
       FROM insurance_documents d
       INNER JOIN storage_objects s
         ON s.id = d.storage_object_id AND s.deleted_at IS NULL
       WHERE d.id = ? AND d.patient_id = ?
       LIMIT 1`,
    )
      .bind(documentId, context.patientId)
      .first<{ id: string; benefits_json: string; original_filename: string }>();
    if (!document) return Response.json({ error: 'Không tìm thấy tài liệu SBC đã chọn.' }, { status: 404 });

    const result = analyzeCoverage({
      profile: parseProfile(document.benefits_json, document.original_filename),
      condition,
      networkStatus,
      estimatedCost,
    });
    const analysisId = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO insurance_analyses
       (id, patient_id, document_id, condition_text, network_status,
        estimated_cost_cents, result_json, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        analysisId,
        context.patientId,
        document.id,
        condition,
        networkStatus,
        estimatedCost === null ? null : Math.round(estimatedCost * 100),
        JSON.stringify(result),
        context.userId,
        now,
      )
      .run();
    await writeAudit(context, 'analyze', 'InsuranceCoverageEstimate', analysisId);

    return Response.json({
      analysis: {
        id: analysisId,
        document_id: document.id,
        document_name: document.original_filename,
        condition,
        network_status: networkStatus,
        estimated_cost: estimatedCost,
        created_at: now,
        result,
      },
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Không thể tạo ước tính quyền lợi lúc này.' }, { status: 500 });
  }
}
