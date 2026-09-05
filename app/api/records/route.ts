import { env } from 'cloudflare:workers';

import { getPatientContext, writeAudit } from '@/db/runtime';

const recordTypes = {
  allergy: 'AllergyIntolerance',
  condition: 'Condition',
  medication: 'MedicationStatement',
  lab: 'Observation',
  encounter: 'Encounter',
} as const;

type RecordType = keyof typeof recordTypes;

type RecordPayload = {
  id?: string;
  record_type?: string;
  title?: string;
  summary?: string;
  status?: string;
  clinical_date?: string;
  provider?: string;
  facility?: string;
  country_code?: string;
  code_system?: string;
  code?: string;
  source?: string;
  verification_status?: string;
  severity?: string;
  details?: Record<string, unknown>;
  attachment_id?: string | null;
};

function clean(value: unknown, limit = 500): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, limit) : null;
}

function validatePayload(body: RecordPayload) {
  const recordType = clean(body.record_type, 30) as RecordType | null;
  const title = clean(body.title, 160);
  const clinicalDate = clean(body.clinical_date, 32);
  if (!recordType || !(recordType in recordTypes)) {
    return { error: 'Choose a supported record type.' } as const;
  }
  if (!title || title.length < 2) {
    return { error: 'Enter a record title of at least 2 characters.' } as const;
  }
  if (!clinicalDate || !/^\d{4}-\d{2}-\d{2}/.test(clinicalDate)) {
    return { error: 'Enter a valid clinical date.' } as const;
  }
  return { recordType, title, clinicalDate } as const;
}

function parseDetails(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  try {
    const context = await getPatientContext(request);
    const result = await env.DB.prepare(
      `SELECT r.*, s.original_filename AS attachment_name,
              s.mime_type AS attachment_mime_type,
              s.byte_size AS attachment_byte_size
       FROM health_records r
       LEFT JOIN storage_objects s
         ON s.id = r.attachment_id AND s.deleted_at IS NULL
       WHERE r.patient_id = ? AND r.deleted_at IS NULL
       ORDER BY r.clinical_date DESC, r.created_at DESC`,
    )
      .bind(context.patientId)
      .all<Record<string, unknown> & { details_json: string }>();

    await writeAudit(context, 'read', 'PatientRecordCollection', context.patientId);
    return Response.json({
      patient: context.patient,
      user: { display_name: context.userDisplayName },
      records: result.results.map((record) => ({
        ...record,
        details: parseDetails(record.details_json),
        details_json: undefined,
      })),
      persistence: 'Cloudflare D1 + private R2 object storage',
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: 'Could not load the demo medical record.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getPatientContext(request);
    const body = (await request.json()) as RecordPayload;
    const validated = validatePayload(body);
    if ('error' in validated) {
      return Response.json({ error: validated.error }, { status: 400 });
    }

    const attachmentId = clean(body.attachment_id, 80);
    if (attachmentId) {
      const ownedFile = await env.DB.prepare(
        `SELECT id FROM storage_objects
         WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
      )
        .bind(attachmentId, context.patientId)
        .first<{ id: string }>();
      if (!ownedFile) {
        return Response.json({ error: 'Attachment not found.' }, { status: 400 });
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO health_records
       (id, patient_id, record_type, fhir_resource_type, title, summary, status,
        clinical_date, provider, facility, country_code, code_system, code,
        source, verification_status, severity, details_json, attachment_id,
        created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
      .bind(
        id,
        context.patientId,
        validated.recordType,
        recordTypes[validated.recordType],
        validated.title,
        clean(body.summary, 2000),
        clean(body.status, 40) ?? 'active',
        validated.clinicalDate,
        clean(body.provider, 120),
        clean(body.facility, 160),
        clean(body.country_code, 3)?.toUpperCase() ?? 'US',
        clean(body.code_system, 80),
        clean(body.code, 40),
        clean(body.source, 80) ?? 'Self-reported',
        clean(body.verification_status, 40) ?? 'self-reported',
        clean(body.severity, 30),
        JSON.stringify(body.details ?? {}).slice(0, 12000),
        attachmentId,
        now,
        now,
      )
      .run();
    await writeAudit(context, 'create', recordTypes[validated.recordType], id);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Could not save this record.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getPatientContext(request);
    const body = (await request.json()) as RecordPayload;
    const id = clean(body.id, 80);
    const validated = validatePayload(body);
    if (!id) return Response.json({ error: 'Record id is required.' }, { status: 400 });
    if ('error' in validated) {
      return Response.json({ error: validated.error }, { status: 400 });
    }

    const owned = await env.DB.prepare(
      `SELECT id FROM health_records
       WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
    )
      .bind(id, context.patientId)
      .first<{ id: string }>();
    if (!owned) return Response.json({ error: 'Record not found.' }, { status: 404 });

    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE health_records SET
        record_type = ?, fhir_resource_type = ?, title = ?, summary = ?,
        status = ?, clinical_date = ?, provider = ?, facility = ?,
        country_code = ?, code_system = ?, code = ?, source = ?,
        verification_status = ?, severity = ?, details_json = ?,
        attachment_id = COALESCE(?, attachment_id), updated_at = ?
       WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
    )
      .bind(
        validated.recordType,
        recordTypes[validated.recordType],
        validated.title,
        clean(body.summary, 2000),
        clean(body.status, 40) ?? 'active',
        validated.clinicalDate,
        clean(body.provider, 120),
        clean(body.facility, 160),
        clean(body.country_code, 3)?.toUpperCase() ?? 'US',
        clean(body.code_system, 80),
        clean(body.code, 40),
        clean(body.source, 80) ?? 'Self-reported',
        clean(body.verification_status, 40) ?? 'self-reported',
        clean(body.severity, 30),
        JSON.stringify(body.details ?? {}).slice(0, 12000),
        clean(body.attachment_id, 80),
        now,
        id,
        context.patientId,
      )
      .run();
    await writeAudit(context, 'update', recordTypes[validated.recordType], id);
    return Response.json({ id });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Could not update this record.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getPatientContext(request);
    const body = (await request.json()) as { id?: string };
    const id = clean(body.id, 80);
    if (!id) return Response.json({ error: 'Record id is required.' }, { status: 400 });
    const existing = await env.DB.prepare(
      `SELECT fhir_resource_type FROM health_records
       WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
    )
      .bind(id, context.patientId)
      .first<{ fhir_resource_type: string }>();
    if (!existing) return Response.json({ error: 'Record not found.' }, { status: 404 });
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE health_records SET deleted_at = ?, updated_at = ?
       WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
    )
      .bind(now, now, id, context.patientId)
      .run();
    await writeAudit(context, 'delete', existing.fhir_resource_type, id);
    return Response.json({ id });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Could not delete this record.' }, { status: 500 });
  }
}
