import { env } from 'cloudflare:workers';
import { demoPatients, demoClinicians, demoEncounters } from '../lib/portal-seed';
import type { Patient, Encounter, Clinician, Feedback, StorageStatus } from '../lib/portal-types';
import { PortalError } from '../lib/portal-validation';

type Document = Patient | Encounter | Feedback | Clinician;
export type PortalBundle = { patients: Patient[]; encounters: Encounter[]; clinicians: Clinician[]; feedback: Feedback[] };
type Kind = 'patient' | 'encounter' | 'feedback' | 'clinician';
type Row = { kind: Kind; payload: string };

const demoPatientNames: Record<string, readonly [legacy: string, english: string]> = {
  'patient-anh': ['Nguyễn Minh Anh', 'Emily Carter'],
  'patient-tuan': ['Trần Quốc Tuấn', 'Michael Johnson'],
  'patient-quynh': ['Lê Ngọc Quỳnh', 'Sophia Martinez'],
  'patient-bao': ['Phạm Gia Bảo', 'Daniel Brooks'],
  'patient-linh': ['Võ Thùy Linh', 'Olivia Bennett'],
};
const demoClinicianNames: Record<string, readonly [legacy: string, english: string]> = {
  'doctor-lan': ['Dr. Nguyễn Hoàng Lan', 'Dr. Sarah Wilson'],
  'doctor-minh': ['Dr. Trần Đức Minh', 'Dr. James Anderson'],
  'doctor-ha': ['Dr. Phạm Thanh Hà', 'Dr. Emily Clark'],
};
const vietnameseText = /[ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/;

function translateFromTemplate<T>(value: T, englishTemplate: unknown): T {
  if (typeof value === 'string') {
    return (vietnameseText.test(value) && typeof englishTemplate === 'string' ? englishTemplate : value) as T;
  }
  if (Array.isArray(value)) {
    const templates = Array.isArray(englishTemplate) ? englishTemplate : [];
    return value.map((item, index) => translateFromTemplate(item, templates[index])) as T;
  }
  if (value && typeof value === 'object') {
    const template = englishTemplate && typeof englishTemplate === 'object' && !Array.isArray(englishTemplate)
      ? englishTemplate as Record<string, unknown>
      : {};
    const translated = { ...value } as Record<string, unknown>;
    for (const key of Object.keys(translated)) translated[key] = translateFromTemplate(translated[key], template[key]);
    return translated as T;
  }
  return value;
}

function translateLegacyDemoIdentities(bundle: PortalBundle): PortalBundle {
  const patientTemplates = new Map(demoPatients().map(patient => [patient.id, patient]));
  const clinicianTemplates = new Map(demoClinicians.map(clinician => [clinician.id, clinician]));
  const encounterTemplates = new Map(demoEncounters().map(encounter => [encounter.id, encounter]));
  const patientName = (patient: Patient) => {
    const names = demoPatientNames[patient.id];
    return names && patient.display_name === names[0] ? { ...patient, display_name: names[1] } : patient;
  };
  const clinicianName = (clinician: Clinician) => {
    const names = demoClinicianNames[clinician.id];
    return names && clinician.name === names[0] ? { ...clinician, name: names[1] } : clinician;
  };
  return {
    ...bundle,
    patients: bundle.patients.map(patient => patientName(translateFromTemplate(patient, patientTemplates.get(patient.id)))),
    clinicians: bundle.clinicians.map(clinician => clinicianName(translateFromTemplate(clinician, clinicianTemplates.get(clinician.id)))),
    encounters: bundle.encounters.map(encounter => {
      const translated = translateFromTemplate(encounter, encounterTemplates.get(encounter.id));
      return { ...translated, clinician: clinicianName(translateFromTemplate(translated.clinician, clinicianTemplates.get(translated.clinician.id))) };
    }),
  };
}

function configuration() {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY?.trim();
  if (url && !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) throw new PortalError('SUPABASE_URL must be a Project URL in the form https://<project-ref>.supabase.co.', 503);
  if (key && !url) throw new PortalError('The Supabase connection is missing its Project URL.', 503);
  return url && key ? { url, key } : null;
}
export function storageStatus(): StorageStatus {
  const config = configuration();
  return { provider: config ? 'supabase' : 'd1', connected: !!config, project_url: config?.url ?? env.SUPABASE_URL ?? 'https://gsllxxdewmksjbcnxgvp.supabase.co', label: config ? 'Connected to Supabase' : 'Demo records · not saved to Supabase', schema_version: 3 };
}
async function rpc<T>(name: string, body: unknown): Promise<T> {
  const config = configuration();
  if (!config) throw new PortalError('Supabase has not been configured.', 503);
  const headers: Record<string, string> = { apikey: config.key, 'Content-Type': 'application/json' };
  if (config.key.startsWith('eyJ')) headers.Authorization = `Bearer ${config.key}`;
  let response: Response;
  try { response = await fetch(`${config.url}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }); }
  catch { throw new PortalError('Could not connect to Supabase. Your draft remains in the form; please try saving again.', 503); }
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { code?: string; message?: string };
    if (error.message?.includes('VERSION_CONFLICT')) throw new PortalError('This record was edited in another window. Reload the data before saving again.', 409);
    if (error.code === '23505') throw new PortalError('That record number is already in use. Choose a different number.', 409);
    if (response.status === 404 || error.code === 'PGRST202') throw new PortalError('The Supabase portal schema is missing. Run migration 20260909000000_medipass_portal.sql in the SQL Editor.', 503);
    throw new PortalError('Supabase could not save the data. Check the connection key and table schema; your draft remains in the form.', 503);
  }
  return response.json() as Promise<T>;
}

export async function workspaceFor(request: Request): Promise<string> {
  const subject = request.headers.get('oai-authenticated-user-id');
  if (!subject) throw new PortalError('Sign in to open the demo records.', 401);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new PortalError('This request did not come from the MediPass website.', 403);
    if (request.headers.get('sec-fetch-site') === 'cross-site') throw new PortalError('Invalid request.', 403);
  }
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`medipass-portal:${subject}`));
  return `demo-${Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')}`;
}

function seedBundle(): PortalBundle {
  const now = new Date().toISOString();
  return {
    patients: demoPatients().map(p => ({ ...p, created_at: now, updated_at: now })),
    clinicians: demoClinicians,
    encounters: demoEncounters().map(e => ({ ...e, created_at: now, updated_at: now, labs: e.labs.map((l, i) => ({ ...l, id: `lab-${i}` })), medications: e.medications.map((m, i) => ({ ...m, id: `med-${i}` })) })),
    feedback: [],
  };
}
async function localEnsure(workspace: string) {
  let exists: { id: string } | null;
  try { exists = await env.DB.prepare('SELECT id FROM portal_spaces WHERE id = ?').bind(workspace).first<{ id: string }>(); }
  catch { throw new PortalError('The demo database migration must be applied before use.', 503); }
  if (exists) return;
  const seed = seedBundle(), now = new Date().toISOString();
  const entries: Array<[Kind, Document[]]> = [['patient', seed.patients], ['clinician', seed.clinicians], ['encounter', seed.encounters]];
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO portal_spaces (id, seeded_at) VALUES (?, ?)').bind(workspace, now),
    ...entries.flatMap(([kind, documents]) => documents.map(document => env.DB.prepare('INSERT OR IGNORE INTO portal_documents (workspace_id, kind, id, version, payload, mutation_id, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)').bind(workspace, kind, document.id, JSON.stringify(document), 'seed-v2', now))),
  ]);
}
export async function readPortal(workspace: string): Promise<PortalBundle> {
  if (configuration()) {
    // A fresh Supabase workspace starts from the user's edited demo, when one
    // exists. Bootstrap is transactional and never overwrites an existing one.
    const exists = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'portal_documents'").first<{ name: string }>();
    const local = exists ? await readLocalPortal(workspace) : null;
    return translateLegacyDemoIdentities(await rpc<PortalBundle>('mp_portal_bootstrap', { p_workspace: workspace, p_seed: local?.patients.length ? local : seedBundle() }));
  }
  await localEnsure(workspace);
  return translateLegacyDemoIdentities(await readLocalPortal(workspace));
}
async function readLocalPortal(workspace: string): Promise<PortalBundle> {
  const rows = await env.DB.prepare('SELECT kind, payload FROM portal_documents WHERE workspace_id = ? ORDER BY updated_at DESC, id').bind(workspace).all<Row>();
  const all: PortalBundle = { patients: [], encounters: [], clinicians: [], feedback: [] };
  for (const row of rows.results) {
    const value = JSON.parse(row.payload);
    if (row.kind === 'patient') all.patients.push(value);
    else if (row.kind === 'encounter') all.encounters.push(value);
    else if (row.kind === 'clinician') all.clinicians.push(value);
    else if (row.kind === 'feedback') all.feedback.push(value);
  }
  all.patients.sort((a, b) => a.medical_record_number.localeCompare(b.medical_record_number));
  return all;
}

export async function savePortal(workspace: string, kind: Exclude<Kind, 'clinician'>, document: Patient | Encounter | Feedback): Promise<Patient | Encounter | Feedback> {
  const data = await readPortal(workspace);
  const list = kind === 'patient' ? data.patients : kind === 'encounter' ? data.encounters : data.feedback;
  const previous = list.find(item => item.id === document.id);
  if (document.version !== (previous?.version ?? 0)) throw new PortalError('This record changed elsewhere. Reload the data before saving.', 409);
  if (kind === 'patient') {
    const p = document as Patient;
    if (data.patients.some(other => other.id !== p.id && other.medical_record_number.toLowerCase() === p.medical_record_number.toLowerCase())) throw new PortalError('That patient record number already exists.', 409);
  }
  if (kind === 'encounter') {
    const e = document as Encounter;
    if (!data.patients.some(p => p.id === e.patient_id)) throw new PortalError('The patient was not found in your portal.', 404);
    if (previous && (previous as Encounter).patient_id !== e.patient_id) throw new PortalError('A visit cannot be moved to another patient.');
  }
  if (kind === 'feedback') {
    const f = document as Feedback;
    if (f.patient_id && !data.patients.some(p => p.id === f.patient_id)) throw new PortalError('The patient linked to this comment was not found.', 404);
    if (f.encounter_id && !data.encounters.some(e => e.id === f.encounter_id && (!f.patient_id || e.patient_id === f.patient_id))) throw new PortalError('The visit linked to this comment was not found.', 404);
  }
  if (configuration()) return rpc('mp_portal_save', { p_workspace: workspace, p_kind: kind, p_document: document, p_expected_version: document.version });
  const now = new Date().toISOString(), mutationId = crypto.randomUUID();
  const saved = { ...document, version: document.version + 1, created_at: previous?.created_at || now, updated_at: now };
  const statement = document.version === 0
    ? env.DB.prepare('INSERT OR IGNORE INTO portal_documents (workspace_id, kind, id, version, payload, mutation_id, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)').bind(workspace, kind, document.id, JSON.stringify(saved), mutationId, now)
    : env.DB.prepare('UPDATE portal_documents SET version = version + 1, payload = ?, mutation_id = ?, updated_at = ? WHERE workspace_id = ? AND kind = ? AND id = ? AND version = ?').bind(JSON.stringify(saved), mutationId, now, workspace, kind, document.id, document.version);
  const statements = [statement, env.DB.prepare('INSERT INTO portal_changes (id, workspace_id, kind, resource_id, action, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM portal_documents WHERE workspace_id = ? AND kind = ? AND id = ? AND mutation_id = ?)').bind(mutationId, workspace, kind, document.id, previous ? 'update' : 'create', now, workspace, kind, document.id, mutationId)];
  if (kind === 'encounter') {
    const doctor = (document as Encounter).clinician;
    statements.push(env.DB.prepare('INSERT INTO portal_documents (workspace_id, kind, id, version, payload, mutation_id, updated_at) SELECT ?, ?, ?, 1, ?, ?, ? WHERE EXISTS (SELECT 1 FROM portal_documents WHERE workspace_id = ? AND kind = ? AND id = ? AND mutation_id = ?) ON CONFLICT(workspace_id, kind, id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at').bind(workspace, 'clinician', doctor.id, JSON.stringify(doctor), mutationId, now, workspace, kind, document.id, mutationId));
  }
  const results = await env.DB.batch(statements);
  if (results[0].meta.changes !== 1) throw new PortalError('Someone just updated this record. Reload it to avoid overwriting their changes.', 409);
  return saved;
}

export async function readBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new PortalError('The request must contain JSON data.', 415);
  const raw = await request.text();
  if (raw.length > 150000) throw new PortalError('The record is too large. Shorten its content.', 413);
  try { return JSON.parse(raw); } catch { throw new PortalError('The JSON content is invalid.'); }
}
export function portalError(error: unknown): Response {
  const known = error instanceof PortalError;
  return Response.json({ error: known ? error.message : 'The record could not be processed right now. Please try again.' }, { status: known ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
}
export function portalJson(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Vary': 'oai-authenticated-user-id' } });
}
