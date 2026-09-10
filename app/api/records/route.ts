import { env } from 'cloudflare:workers';

import {
  canManagePatient,
  getPatientContext,
  writeAudit,
  type PatientContext,
} from '@/db/runtime';
import {
  createSupabaseRecord,
  ensureSupabasePatient,
  isSupabaseConfigured,
  listSupabaseRecords,
  softDeleteSupabaseRecord,
  updateSupabaseRecord,
  writeSupabaseAudit,
  type SupabaseRecord,
} from '@/db/supabase';

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

function denyReadOnly(context: PatientContext) {
  return canManagePatient(context)
    ? null
    : Response.json(
        { error: 'This patient account has read-only access.' },
        { status: 403 },
      );
}

async function audit(
  context: PatientContext,
  action: string,
  resourceType: string,
  resourceId: string | null,
) {
  await writeAudit(context, action, resourceType, resourceId);
  if (isSupabaseConfigured()) {
    try {
      await writeSupabaseAudit(context, action, resourceType, resourceId);
    } catch (error) {
      console.error('Supabase audit mirror failed', error);
    }
  }
}

async function attachmentMetadata(patientId: string) {
  const result = await env.DB.prepare(
    `SELECT id, original_filename, mime_type, byte_size
     FROM storage_objects
     WHERE patient_id = ? AND deleted_at IS NULL`,
  )
    .bind(patientId)
    .all<{
      id: string;
      original_filename: string;
      mime_type: string;
      byte_size: string;
    }>();
  return new Map(result.results.map((item) => [item.id, item]));
}

export async function GET(request: Request) {
  try {
    const context = await getPatientContext(request);
    let records: Array<Record<string, unknown>>;
    let persistence = 'Cloudflare D1 + private R2 object storage';

    if (isSupabaseConfigured()) {
      await ensureSupabasePatient(context);
      const remote = await listSupabaseRecords(context.patientId);
      const attachments = await attachmentMetadata(context.patientId);
      records = remote.map((record) => {
        const attachment = record.attachment_id
          ? attachments.get(record.attachment_id)
          : undefined;
        return {
          ...record,
          attachment_name: attachment?.original_filename ?? null,
          attachment_mime_type: attachment?.mime_type ?? null,
          attachment_byte_size: attachment?.byte_size ?? null,
        };
      });
      persistence = 'Supabase Postgres + private Cloudflare R2 object storage';
    } else {
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
      records = result.results.map(({ details_json, ...record }) => ({
        ...record,
        details: parseDetails(details_json),
      }));
    }

    await audit(context, 'read', 'PatientRecordCollection', context.patientId);
    return Response.json({
      patient: context.patient,
      user: { display_name: context.userDisplayName },
      access: { role: context.role, can_write: canManagePatient(context) },
      records,
      persistence,
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
    const denied = denyReadOnly(context);
    if (denied) return denied;
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
    const record: SupabaseRecord = {
      id,
      patient_id: context.patientId,
      record_type: validated.recordType,
      fhir_resource_type: recordTypes[validated.recordType],
      title: validated.title,
      summary: clean(body.summary, 2000),
      status: clean(body.status, 40) ?? 'active',
      clinical_date: validated.clinicalDate,
      provider: clean(body.provider, 120),
      facility: clean(body.facility, 160),
      country_code: clean(body.country_code, 3)?.toUpperCase() ?? 'US',
      code_system: clean(body.code_system, 80),
      code: clean(body.code, 40),
      source: clean(body.source, 80) ?? 'Care team entry',
      verification_status: clean(body.verification_status, 40) ?? 'unverified',
      severity: clean(body.severity, 30),
      details: body.details ?? {},
      attachment_id: attachmentId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    if (isSupabaseConfigured()) {
      await ensureSupabasePatient(context);
      await createSupabaseRecord(record);
    } else {
      await env.DB.prepare(
        `INSERT INTO health_records
         (id, patient_id, record_type, fhir_resource_type, title, summary, status,
          clinical_date, provider, facility, country_code, code_system, code,
          source, verification_status, severity, details_json, attachment_id,
          created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
        .bind(
          record.id,
          record.patient_id,
          record.record_type,
          record.fhir_resource_type,
          record.title,
          record.summary,
          record.status,
          record.clinical_date,
          record.provider,
          record.facility,
          record.country_code,
          record.code_system,
          record.code,
          record.source,
          record.verification_status,
          record.severity,
          JSON.stringify(record.details).slice(0, 12000),
          record.attachment_id,
          record.created_at,
          record.updated_at,
        )
        .run();
    }
    await audit(context, 'create', record.fhir_resource_type, id);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Could not save this record.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getPatientContext(request);
    const denied = denyReadOnly(context);
    if (denied) return denied;
    const body = (await request.json()) as RecordPayload;
    const id = clean(body.id, 80);
    const validated = validatePayload(body);
    if (!id) return Response.json({ error: 'Record id is required.' }, { status: 400 });
    if ('error' in validated) {
      return Response.json({ error: validated.error }, { status: 400 });
    }

    const now = new Date().toISOString();
    const update: Partial<SupabaseRecord> = {
      record_type: validated.recordType,
      fhir_resource_type: recordTypes[validated.recordType],
      title: validated.title,
      summary: clean(body.summary, 2000),
      status: clean(body.status, 40) ?? 'active',
      clinical_date: validated.clinicalDate,
      provider: clean(body.provider, 120),
      facility: clean(body.facility, 160),
      country_code: clean(body.country_code, 3)?.toUpperCase() ?? 'US',
      code_system: clean(body.code_system, 80),
      code: clean(body.code, 40),
      source: clean(body.source, 80) ?? 'Care team entry',
      verification_status: clean(body.verification_status, 40) ?? 'unverified',
      severity: clean(body.severity, 30),
      details: body.details ?? {},
      attachment_id: clean(body.attachment_id, 80),
      updated_at: now,
    };

    if (isSupabaseConfigured()) {
      await ensureSupabasePatient(context);
      const updated = await updateSupabaseRecord(context.patientId, id, update);
      if (!updated) return Response.json({ error: 'Record not found.' }, { status: 404 });
    } else {
      const owned = await env.DB.prepare(
        `SELECT id FROM health_records
         WHERE id = ? AND patient_id = ? AND deleted_at IS NULL`,
      )
        .bind(id, context.patientId)
        .first<{ id: string }>();
      if (!owned) return Response.json({ error: 'Record not found.' }, { status: 404 });
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
          update.record_type,
          update.fhir_resource_type,
          update.title,
          update.summary,
          update.status,
          update.clinical_date,
          update.provider,
          update.facility,
          update.country_code,
          update.code_system,
          update.code,
          update.source,
          update.verification_status,
          update.severity,
          JSON.stringify(update.details).slice(0, 12000),
          update.attachment_id,
          now,
          id,
          context.patientId,
        )
        .run();
    }
    await audit(context, 'update', recordTypes[validated.recordType], id);
    return Response.json({ id });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Could not update this record.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getPatientContext(request);
    const denied = denyReadOnly(context);
    if (denied) return denied;
    const body = (await request.json()) as { id?: string };
    const id = clean(body.id, 80);
    if (!id) return Response.json({ error: 'Record id is required.' }, { status: 400 });

    let resourceType: string;
    if (isSupabaseConfigured()) {
      await ensureSupabasePatient(context);
      const existing = await softDeleteSupabaseRecord(context.patientId, id);
      if (!existing) return Response.json({ error: 'Record not found.' }, { status: 404 });
      resourceType = existing.fhir_resource_type;
    } else {
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
      resourceType = existing.fhir_resource_type;
    }
    await audit(context, 'delete', resourceType, id);
    return Response.json({ id });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Could not delete this record.' }, { status: 500 });
  }
}
