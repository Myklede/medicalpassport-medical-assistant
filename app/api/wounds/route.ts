import { env } from 'cloudflare:workers';

import { getPatientContext, writeAudit } from '@/db/runtime';
import {
  ensureSupabasePatient,
  isSupabaseConfigured,
  listSupabaseRecords,
} from '@/db/supabase';
import {
  emptyWoundSymptoms,
  findHistoryFactors,
  reviewWoundSafety,
  type HealthContextRecord,
  type WoundSymptoms,
} from '@/lib/wound-safety';
import { woundModelStatus } from '@/lib/vision/wound-model';

const allowedImageTypes = new Set(['image/jpeg', 'image/png']);
const maxImageBytes = 8 * 1024 * 1024;

type WoundCaseRow = {
  id: string;
  label: string;
  body_location: string;
  wound_type: string;
  onset_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type WoundAssessmentRow = {
  id: string;
  wound_case_id: string;
  image_object_id: string;
  captured_at: string;
  pain_score: number;
  symptoms_json: string;
  capture_json: string;
  notes: string | null;
  triage_level: string;
  triage_reasons_json: string;
  history_factors_json: string;
  created_at: string;
  original_filename: string;
};

function clean(value: FormDataEntryValue | null, limit: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, limit);
}

function safeFilename(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 100);
  return cleaned || 'wound-capture.jpg';
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseSymptoms(value: string): WoundSymptoms {
  const parsed = parseJson<Record<string, unknown>>(value, {});
  const symptoms = emptyWoundSymptoms();
  for (const key of Object.keys(symptoms) as Array<keyof WoundSymptoms>) {
    symptoms[key] = parsed[key] === true;
  }
  return symptoms;
}

async function loadHealthContext(patientId: string): Promise<HealthContextRecord[]> {
  if (isSupabaseConfigured()) {
    const records = await listSupabaseRecords(patientId);
    return records.map((record) => ({
      record_type: record.record_type,
      title: record.title,
      summary: record.summary,
      status: record.status,
    }));
  }

  const result = await env.DB.prepare(
    `SELECT record_type, title, summary, status
     FROM health_records
     WHERE patient_id = ? AND deleted_at IS NULL`,
  )
    .bind(patientId)
    .all<HealthContextRecord>();
  return result.results;
}

export async function GET(request: Request) {
  try {
    const context = await getPatientContext(request);
    if (isSupabaseConfigured()) await ensureSupabasePatient(context);

    const [caseResult, assessmentResult, healthRecords] = await Promise.all([
      env.DB.prepare(
        `SELECT id, label, body_location, wound_type, onset_date, status,
                created_at, updated_at
         FROM wound_cases
         WHERE patient_id = ? AND deleted_at IS NULL
         ORDER BY updated_at DESC`,
      )
        .bind(context.patientId)
        .all<WoundCaseRow>(),
      env.DB.prepare(
        `SELECT a.id, a.wound_case_id, a.image_object_id, a.captured_at,
                a.pain_score, a.symptoms_json, a.capture_json, a.notes,
                a.triage_level, a.triage_reasons_json,
                a.history_factors_json, a.created_at, s.original_filename
         FROM wound_assessments a
         INNER JOIN storage_objects s
           ON s.id = a.image_object_id AND s.deleted_at IS NULL
         WHERE a.patient_id = ? AND a.deleted_at IS NULL
         ORDER BY a.captured_at DESC, a.created_at DESC`,
      )
        .bind(context.patientId)
        .all<WoundAssessmentRow>(),
      loadHealthContext(context.patientId),
    ]);

    const assessmentsByCase = new Map<string, Array<Record<string, unknown>>>();
    for (const row of assessmentResult.results) {
      const assessments = assessmentsByCase.get(row.wound_case_id) ?? [];
      assessments.push({
        id: row.id,
        image_object_id: row.image_object_id,
        image_url: `/api/files?id=${encodeURIComponent(row.image_object_id)}`,
        image_name: row.original_filename,
        captured_at: row.captured_at,
        pain_score: row.pain_score,
        symptoms: parseJson(row.symptoms_json, {}),
        capture: parseJson(row.capture_json, {}),
        notes: row.notes,
        triage_level: row.triage_level,
        safety_review: parseJson(row.triage_reasons_json, {}),
        history_factors: parseJson(row.history_factors_json, []),
        created_at: row.created_at,
      });
      assessmentsByCase.set(row.wound_case_id, assessments);
    }

    await writeAudit(
      context,
      'read',
      'WoundAssessmentCollection',
      context.patientId,
    );

    return Response.json({
      patient: context.patient,
      access: { role: context.role, can_capture: true },
      patient_context: {
        matched_factors: findHistoryFactors(healthRecords),
        record_count: healthRecords.length,
      },
      model: woundModelStatus,
      cases: caseResult.results.map((woundCase) => ({
        ...woundCase,
        assessments: assessmentsByCase.get(woundCase.id) ?? [],
      })),
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: 'Could not load wound-monitoring data.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let uploadedObjectKey: string | null = null;
  try {
    const context = await getPatientContext(request);
    if (isSupabaseConfigured()) await ensureSupabasePatient(context);
    const formData = await request.formData();
    const image = formData.get('image');
    if (!(image instanceof File)) {
      return Response.json(
        { error: 'Take or choose a wound photo.' },
        { status: 400 },
      );
    }
    if (!allowedImageTypes.has(image.type)) {
      return Response.json(
        { error: 'Wound captures must be JPEG or PNG images.' },
        { status: 400 },
      );
    }
    if (!image.size || image.size > maxImageBytes) {
      return Response.json(
        { error: 'The wound photo must be between 1 byte and 8 MB.' },
        { status: 400 },
      );
    }
    if (clean(formData.get('consent_attested'), 5) !== 'true') {
      return Response.json(
        { error: 'Confirm that you have permission to use this de-identified photo.' },
        { status: 400 },
      );
    }
    if (clean(formData.get('research_use_only'), 5) !== 'true') {
      return Response.json(
        { error: 'Confirm that this prototype is not emergency or diagnostic care.' },
        { status: 400 },
      );
    }

    const requestedCaseId = clean(formData.get('case_id'), 80);
    const label = clean(formData.get('label'), 120);
    let bodyLocation = clean(formData.get('body_location'), 100);
    const woundType = clean(formData.get('wound_type'), 40) || 'unknown';
    const onsetDate = clean(formData.get('onset_date'), 10) || null;
    const capturedAtInput = clean(formData.get('captured_at'), 32);
    const capturedAtDate = new Date(capturedAtInput);
    const capturedAt = Number.isNaN(capturedAtDate.getTime())
      ? new Date().toISOString()
      : capturedAtDate.toISOString();
    const painScore = Math.max(
      0,
      Math.min(10, Number.parseInt(clean(formData.get('pain_score'), 2), 10) || 0),
    );
    const symptoms = parseSymptoms(clean(formData.get('symptoms'), 5000));
    const notes = clean(formData.get('notes'), 1500) || null;
    const hasScaleMarker = clean(formData.get('has_scale_marker'), 5) === 'true';

    let woundCaseId = requestedCaseId;
    let newCase = false;
    if (woundCaseId) {
      const existing = await env.DB.prepare(
        `SELECT id, body_location
         FROM wound_cases
         WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
      )
        .bind(woundCaseId, context.patientId)
        .first<{ id: string; body_location: string }>();
      if (!existing) {
        return Response.json({ error: 'Wound case not found.' }, { status: 404 });
      }
      bodyLocation = existing.body_location;
    } else {
      if (label.length < 2 || bodyLocation.length < 2) {
        return Response.json(
          { error: 'Enter a short case name and body location.' },
          { status: 400 },
        );
      }
      woundCaseId = crypto.randomUUID();
      newCase = true;
    }

    const healthRecords = await loadHealthContext(context.patientId);
    const safetyReview = reviewWoundSafety({
      symptoms,
      painScore,
      bodyLocation,
      records: healthRecords,
    });

    if (!env.FILES) throw new Error('The R2 file binding is unavailable.');
    const imageObjectId = crypto.randomUUID();
    const filename = safeFilename(image.name || 'wound-capture.jpg');
    uploadedObjectKey = `patients/${context.patientId}/wounds/${woundCaseId}/${imageObjectId}-${filename}`;
    await env.FILES.put(uploadedObjectKey, await image.arrayBuffer(), {
      httpMetadata: { contentType: image.type },
      customMetadata: {
        recordOwner: context.patientId,
        purpose: 'wound-assessment-rgb',
      },
    });

    const now = new Date().toISOString();
    const assessmentId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [];
    if (newCase) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO wound_cases
           (id, patient_id, label, body_location, wound_type, onset_date, status,
            created_by_user_id, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, NULL)`,
        ).bind(
          woundCaseId,
          context.patientId,
          label,
          bodyLocation,
          woundType,
          onsetDate,
          context.userId,
          now,
          now,
        ),
      );
    } else {
      statements.push(
        env.DB.prepare(
          `UPDATE wound_cases SET updated_at = ?
           WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
        ).bind(now, woundCaseId, context.patientId),
      );
    }
    statements.push(
      env.DB.prepare(
        `INSERT INTO storage_objects
         (id, patient_id, object_key, original_filename, mime_type, byte_size,
          purpose, uploaded_by_user_id, created_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, 'wound-assessment-rgb', ?, ?, NULL)`,
      ).bind(
        imageObjectId,
        context.patientId,
        uploadedObjectKey,
        image.name.slice(0, 180) || 'wound-capture.jpg',
        image.type,
        String(image.size),
        context.userId,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO wound_assessments
         (id, wound_case_id, patient_id, image_object_id, captured_at,
          pain_score, symptoms_json, capture_json, notes, triage_level,
          triage_reasons_json, history_factors_json, created_by_user_id,
          created_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      ).bind(
        assessmentId,
        woundCaseId,
        context.patientId,
        imageObjectId,
        capturedAt,
        painScore,
        JSON.stringify(symptoms),
        JSON.stringify({
          modality: 'rgb',
          hasScaleMarker,
          consentAttested: true,
          exifRemovedByClient: clean(formData.get('exif_removed'), 5) === 'true',
        }),
        notes,
        safetyReview.level,
        JSON.stringify(safetyReview),
        JSON.stringify(safetyReview.historyFactors),
        context.userId,
        now,
      ),
    );

    await env.DB.batch(statements);
    await writeAudit(context, 'create', 'WoundAssessment', assessmentId);
    uploadedObjectKey = null;

    return Response.json(
      {
        case_id: woundCaseId,
        assessment_id: assessmentId,
        safety_review: safetyReview,
        model: woundModelStatus,
      },
      { status: 201 },
    );
  } catch (error) {
    if (uploadedObjectKey && env.FILES) {
      try {
        await env.FILES.delete(uploadedObjectKey);
      } catch (cleanupError) {
        console.error('Could not clean up wound image after a failed save', cleanupError);
      }
    }
    console.error(error);
    return Response.json(
      { error: 'Could not save this wound assessment.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getPatientContext(request);
    const body = (await request.json()) as { assessment_id?: string };
    const assessmentId =
      typeof body.assessment_id === 'string'
        ? body.assessment_id.trim().slice(0, 80)
        : '';
    if (!assessmentId) {
      return Response.json(
        { error: 'Assessment id is required.' },
        { status: 400 },
      );
    }

    const assessment = await env.DB.prepare(
      `SELECT a.id, a.wound_case_id, a.image_object_id, s.object_key
       FROM wound_assessments a
       INNER JOIN storage_objects s ON s.id = a.image_object_id
       WHERE a.id = ? AND a.patient_id = ? AND a.deleted_at IS NULL`,
    )
      .bind(assessmentId, context.patientId)
      .first<{
        id: string;
        wound_case_id: string;
        image_object_id: string;
        object_key: string;
      }>();
    if (!assessment) {
      return Response.json({ error: 'Assessment not found.' }, { status: 404 });
    }

    await env.FILES.delete(assessment.object_key);
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE wound_assessments SET deleted_at = ?
         WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
      ).bind(now, assessment.id, context.patientId),
      env.DB.prepare(
        `UPDATE storage_objects SET deleted_at = ?
         WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
      ).bind(now, assessment.image_object_id, context.patientId),
      env.DB.prepare(
        `UPDATE wound_cases SET updated_at = ?
         WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
      ).bind(now, assessment.wound_case_id, context.patientId),
    ]);

    const remaining = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM wound_assessments
       WHERE wound_case_id = ? AND patient_id = ? AND deleted_at IS NULL`,
    )
      .bind(assessment.wound_case_id, context.patientId)
      .first<{ total: number }>();
    if (!remaining?.total) {
      await env.DB.prepare(
        `UPDATE wound_cases SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
      )
        .bind(now, now, assessment.wound_case_id, context.patientId)
        .run();
    }

    await writeAudit(context, 'delete', 'WoundAssessment', assessment.id);
    return Response.json({ id: assessment.id });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: 'Could not remove this wound assessment.' },
      { status: 500 },
    );
  }
}
