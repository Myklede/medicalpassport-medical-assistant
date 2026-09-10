import { env } from 'cloudflare:workers';

import type { PatientContext } from './runtime';

export type SupabaseRecord = {
  id: string;
  patient_id: string;
  record_type: string;
  fhir_resource_type: string;
  title: string;
  summary: string | null;
  status: string;
  clinical_date: string;
  provider: string | null;
  facility: string | null;
  country_code: string | null;
  code_system: string | null;
  code: string | null;
  source: string;
  verification_status: string;
  severity: string | null;
  details: Record<string, unknown>;
  attachment_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function configuration() {
  const runtimeEnv = env as Cloudflare.Env;
  const url = runtimeEnv.SUPABASE_URL?.replace(/\/$/, '');
  const key = runtimeEnv.SUPABASE_SECRET_KEY;
  return url && key ? { url, key } : null;
}

export function isSupabaseConfigured() {
  return Boolean(configuration());
}

async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
  prefer?: string,
): Promise<T> {
  const config = configuration();
  if (!config) throw new Error('Supabase is not configured.');
  const headers = new Headers(init.headers);
  headers.set('apikey', config.key);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (prefer) headers.set('Prefer', prefer);
  if (config.key.startsWith('eyJ')) {
    headers.set('Authorization', `Bearer ${config.key}`);
  }
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Supabase request failed (${response.status}): ${detail}`);
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function ensureSupabasePatient(context: PatientContext) {
  const now = new Date().toISOString();
  await supabaseRequest<void>(
    'medipass_patients?on_conflict=id',
    {
      method: 'POST',
      body: JSON.stringify({
        ...context.patient,
        updated_at: now,
      }),
    },
    'resolution=merge-duplicates,return=minimal',
  );

  const remote = await supabaseRequest<Array<{ id: string }>>(
    `medipass_health_records?patient_id=eq.${encodeURIComponent(context.patientId)}&deleted_at=is.null&select=id&limit=1`,
  );
  if (remote.length) return;

  const local = await env.DB.prepare(
    `SELECT * FROM health_records
     WHERE patient_id = ? AND deleted_at IS NULL
     ORDER BY clinical_date DESC, created_at DESC`,
  )
    .bind(context.patientId)
    .all<Record<string, unknown> & { details_json: string }>();
  if (!local.results.length) return;

  await supabaseRequest<void>(
    'medipass_health_records',
    {
      method: 'POST',
      body: JSON.stringify(
        local.results.map(({ details_json, ...record }) => ({
          ...record,
          details: JSON.parse(details_json || '{}'),
        })),
      ),
    },
    'return=minimal',
  );
}

export async function listSupabaseRecords(patientId: string) {
  return supabaseRequest<SupabaseRecord[]>(
    `medipass_health_records?patient_id=eq.${encodeURIComponent(patientId)}&deleted_at=is.null&select=*&order=clinical_date.desc,created_at.desc`,
  );
}

export async function createSupabaseRecord(record: SupabaseRecord) {
  await supabaseRequest<void>(
    'medipass_health_records',
    { method: 'POST', body: JSON.stringify(record) },
    'return=minimal',
  );
}

export async function updateSupabaseRecord(
  patientId: string,
  id: string,
  record: Partial<SupabaseRecord>,
) {
  const rows = await supabaseRequest<Array<{ id: string }>>(
    `medipass_health_records?id=eq.${encodeURIComponent(id)}&patient_id=eq.${encodeURIComponent(patientId)}&deleted_at=is.null&select=id`,
    { method: 'PATCH', body: JSON.stringify(record) },
    'return=representation',
  );
  return rows.length > 0;
}

export async function softDeleteSupabaseRecord(patientId: string, id: string) {
  const now = new Date().toISOString();
  const rows = await supabaseRequest<Array<{ id: string; fhir_resource_type: string }>>(
    `medipass_health_records?id=eq.${encodeURIComponent(id)}&patient_id=eq.${encodeURIComponent(patientId)}&deleted_at=is.null&select=id,fhir_resource_type`,
    { method: 'PATCH', body: JSON.stringify({ deleted_at: now, updated_at: now }) },
    'return=representation',
  );
  return rows[0] ?? null;
}

export async function writeSupabaseAudit(
  context: Pick<PatientContext, 'userId' | 'patientId'>,
  action: string,
  resourceType: string,
  resourceId: string | null,
  outcome = 'success',
) {
  await supabaseRequest<void>(
    'medipass_audit_events',
    {
      method: 'POST',
      body: JSON.stringify({
        id: crypto.randomUUID(),
        actor_user_id: context.userId,
        patient_id: context.patientId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        outcome,
        created_at: new Date().toISOString(),
      }),
    },
    'return=minimal',
  );
}
