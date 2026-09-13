import { env } from 'cloudflare:workers';
import { extractText, getDocumentProxy } from 'unpdf';

import { getPatientContext, writeAudit } from '@/db/runtime';
import {
  buildPolicyProfile,
  type CoverageAnalysis,
  type PolicyProfile,
} from '@/lib/insurance-analysis';

const maxPdfBytes = 8 * 1024 * 1024;
const maxPdfPages = 40;

type InsuranceDocumentRow = {
  id: string;
  storage_object_id: string;
  plan_name: string;
  extraction_status: string;
  page_count: number;
  benefits_json: string;
  created_at: string;
  original_filename: string;
  byte_size: string;
};

type InsuranceAnalysisRow = {
  id: string;
  document_id: string;
  condition_text: string;
  network_status: string;
  estimated_cost_cents: number | null;
  result_json: string;
  created_at: string;
  original_filename: string;
};

function safeFilename(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100);
  return cleaned || 'insurance-sbc.pdf';
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isPdf(bytes: Uint8Array) {
  return bytes.length >= 5
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46
    && bytes[4] === 0x2d;
}

async function extractProfile(bytes: Uint8Array, filename: string) {
  let pageCount = 0;
  try {
    const pdf = await getDocumentProxy(bytes);
    pageCount = pdf.numPages;
    if (pageCount > maxPdfPages) {
      return {
        profile: { ...buildPolicyProfile([], filename), pageCount },
        status: 'demo-fallback',
      };
    }
    const extracted = await Promise.race([
      extractText(pdf, { mergePages: false }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('PDF extraction timed out.')), 12_000);
      }),
    ]);
    const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
    const profile = buildPolicyProfile(pages, filename);
    return { profile: { ...profile, pageCount }, status: profile.extractionMode };
  } catch (error) {
    console.error('SBC text extraction was unavailable', error);
    return {
      profile: { ...buildPolicyProfile([], filename), pageCount },
      status: 'demo-fallback',
    };
  }
}

export async function GET(request: Request) {
  try {
    const context = await getPatientContext(request);
    const downloadId = new URL(request.url).searchParams.get('download');
    if (downloadId) {
      const document = await env.DB.prepare(
        `SELECT d.id, s.id AS storage_object_id, s.object_key,
                s.original_filename, s.mime_type
         FROM insurance_documents d
         INNER JOIN storage_objects s
           ON s.id = d.storage_object_id AND s.deleted_at IS NULL
         WHERE d.id = ? AND d.patient_id = ?
         LIMIT 1`,
      )
        .bind(downloadId.slice(0, 80), context.patientId)
        .first<{
          id: string;
          storage_object_id: string;
          object_key: string;
          original_filename: string;
          mime_type: string;
        }>();
      if (!document) return Response.json({ error: 'SBC document not found.' }, { status: 404 });
      const object = await env.FILES.get(document.object_key);
      if (!object) return Response.json({ error: 'SBC file not found.' }, { status: 404 });
      await writeAudit(context, 'download', 'InsuranceSBC', document.id);
      return new Response(object.body, {
        headers: {
          'Content-Type': document.mime_type,
          'Content-Disposition': `attachment; filename="${safeFilename(document.original_filename)}"; filename*=UTF-8''${encodeURIComponent(document.original_filename)}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const [documentsResult, analysesResult] = await Promise.all([
      env.DB.prepare(
        `SELECT d.id, d.storage_object_id, d.plan_name,
                d.extraction_status, d.page_count, d.benefits_json,
                d.created_at, s.original_filename, s.byte_size
         FROM insurance_documents d
         INNER JOIN storage_objects s
           ON s.id = d.storage_object_id AND s.deleted_at IS NULL
         WHERE d.patient_id = ?
         ORDER BY d.created_at DESC`,
      )
        .bind(context.patientId)
        .all<InsuranceDocumentRow>(),
      env.DB.prepare(
        `SELECT a.id, a.document_id, a.condition_text, a.network_status,
                a.estimated_cost_cents, a.result_json, a.created_at,
                s.original_filename
         FROM insurance_analyses a
         INNER JOIN insurance_documents d
           ON d.id = a.document_id AND d.patient_id = a.patient_id
         INNER JOIN storage_objects s
           ON s.id = d.storage_object_id AND s.deleted_at IS NULL
         WHERE a.patient_id = ?
         ORDER BY a.created_at DESC
         LIMIT 8`,
      )
        .bind(context.patientId)
        .all<InsuranceAnalysisRow>(),
    ]);

    await writeAudit(context, 'read', 'InsuranceSBCCollection', context.patientId);
    return Response.json({
      access: { role: context.role, can_upload: true },
      documents: documentsResult.results.map((row) => ({
        id: row.id,
        name: row.original_filename,
        plan_name: row.plan_name,
        byte_size: Number(row.byte_size),
        page_count: row.page_count,
        extraction_status: row.extraction_status,
        created_at: row.created_at,
        profile: parseJson<PolicyProfile | null>(row.benefits_json, null),
        download_url: `/api/insurance/documents?download=${encodeURIComponent(row.id)}`,
      })),
      analyses: analysesResult.results.map((row) => ({
        id: row.id,
        document_id: row.document_id,
        document_name: row.original_filename,
        condition: row.condition_text,
        network_status: row.network_status,
        estimated_cost: row.estimated_cost_cents === null ? null : row.estimated_cost_cents / 100,
        created_at: row.created_at,
        result: parseJson<CoverageAnalysis | null>(row.result_json, null),
      })),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Unable to load the SBC library right now.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let uploadedObjectKey: string | null = null;
  try {
    const context = await getPatientContext(request);
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'Choose an SBC document.' }, { status: 400 });
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'The SBC must be a PDF document.' }, { status: 400 });
    }
    if (!file.size || file.size > maxPdfBytes) {
      return Response.json({ error: 'The PDF must be between 1 byte and 8 MB.' }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isPdf(bytes)) {
      return Response.json({ error: 'The selected file does not have a valid PDF structure.' }, { status: 400 });
    }
    if (!env.FILES) throw new Error('The R2 file binding is unavailable.');

    const storageObjectId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    const filename = safeFilename(file.name);
    uploadedObjectKey = `patients/${context.patientId}/insurance/${storageObjectId}-${filename}`;
    await env.FILES.put(uploadedObjectKey, bytes, {
      httpMetadata: { contentType: 'application/pdf' },
      customMetadata: {
        recordOwner: context.patientId,
        purpose: 'insurance-sbc',
      },
    });

    const extraction = await extractProfile(bytes, file.name);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO storage_objects
         (id, patient_id, object_key, original_filename, mime_type, byte_size,
          purpose, uploaded_by_user_id, created_at, deleted_at)
         VALUES (?, ?, ?, ?, 'application/pdf', ?, 'insurance-sbc', ?, ?, NULL)`,
      ).bind(
        storageObjectId,
        context.patientId,
        uploadedObjectKey,
        file.name.slice(0, 180),
        String(file.size),
        context.userId,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO insurance_documents
         (id, patient_id, storage_object_id, plan_name, extraction_status,
          page_count, benefits_json, uploaded_by_user_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        documentId,
        context.patientId,
        storageObjectId,
        extraction.profile.planName.slice(0, 180),
        extraction.status,
        extraction.profile.pageCount,
        JSON.stringify(extraction.profile),
        context.userId,
        now,
      ),
    ]);
    await writeAudit(context, 'upload', 'InsuranceSBC', documentId);
    uploadedObjectKey = null;

    return Response.json({
      document: {
        id: documentId,
        name: file.name,
        plan_name: extraction.profile.planName,
        byte_size: file.size,
        page_count: extraction.profile.pageCount,
        extraction_status: extraction.status,
        created_at: now,
        profile: extraction.profile,
        download_url: `/api/insurance/documents?download=${encodeURIComponent(documentId)}`,
      },
    }, { status: 201 });
  } catch (error) {
    if (uploadedObjectKey && env.FILES) {
      try {
        await env.FILES.delete(uploadedObjectKey);
      } catch (cleanupError) {
        console.error('Could not clean up SBC after a failed save', cleanupError);
      }
    }
    console.error(error);
    return Response.json({ error: 'Unable to save this SBC document.' }, { status: 500 });
  }
}
