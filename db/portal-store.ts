import { env } from 'cloudflare:workers';
import { demoPatients, demoClinicians, demoEncounters } from '../lib/portal-seed';
import type { Patient, Encounter, Clinician, Feedback, StorageStatus } from '../lib/portal-types';
import { PortalError } from '../lib/portal-validation';

type Document = Patient | Encounter | Feedback | Clinician;
export type PortalBundle = { patients: Patient[]; encounters: Encounter[]; clinicians: Clinician[]; feedback: Feedback[] };
type Kind = 'patient' | 'encounter' | 'feedback' | 'clinician';
type Row = { kind: Kind; payload: string };

function configuration() {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = env.SUPABASE_SECRET_KEY?.trim();
  if (url && !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) throw new PortalError('SUPABASE_URL phải là Project URL https://<project-ref>.supabase.co.', 503);
  if (Boolean(url) !== Boolean(key)) throw new PortalError('Kết nối Supabase thiếu Project URL hoặc Secret key.', 503);
  return url && key ? { url, key } : null;
}
export function storageStatus(): StorageStatus {
  const config = configuration();
  return { provider: config ? 'supabase' : 'd1', connected: !!config, project_url: config?.url ?? null, label: config ? 'Đã kết nối Supabase' : 'Lưu demo · chưa kết nối Supabase', schema_version: 2 };
}
async function rpc<T>(name: string, body: unknown): Promise<T> {
  const config = configuration();
  if (!config) throw new PortalError('Chưa cấu hình Supabase.', 503);
  const headers: Record<string, string> = { apikey: config.key, 'Content-Type': 'application/json' };
  if (config.key.startsWith('eyJ')) headers.Authorization = `Bearer ${config.key}`;
  let response: Response;
  try { response = await fetch(`${config.url}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }); }
  catch { throw new PortalError('Không kết nối được Supabase. Bản nhập vẫn được giữ trong biểu mẫu; hãy thử lưu lại.', 503); }
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { code?: string; message?: string };
    if (error.message?.includes('VERSION_CONFLICT')) throw new PortalError('Hồ sơ đã được chỉnh sửa ở cửa sổ khác. Tải lại dữ liệu trước khi lưu tiếp.', 409);
    if (error.code === '23505') throw new PortalError('Mã hồ sơ bị trùng. Hãy dùng một mã khác.', 409);
    if (response.status === 404 || error.code === 'PGRST202') throw new PortalError('Supabase chưa có cấu trúc portal. Cần chạy migration 20260909000000_medipass_portal.sql trong SQL Editor.', 503);
    throw new PortalError('Supabase chưa lưu được dữ liệu. Kiểm tra khóa kết nối và cấu trúc bảng; bản nhập vẫn được giữ lại.', 503);
  }
  return response.json() as Promise<T>;
}

export async function workspaceFor(request: Request): Promise<string> {
  const subject = request.headers.get('oai-authenticated-user-id');
  if (!subject) throw new PortalError('Vui lòng đăng nhập để mở hồ sơ demo.', 401);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new PortalError('Yêu cầu không đến từ website này.', 403);
    if (request.headers.get('sec-fetch-site') === 'cross-site') throw new PortalError('Yêu cầu không hợp lệ.', 403);
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
  catch { throw new PortalError('Cơ sở dữ liệu demo cần được cập nhật migration trước khi sử dụng.', 503); }
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
    return rpc<PortalBundle>('mp_portal_bootstrap', { p_workspace: workspace, p_seed: local?.patients.length ? local : seedBundle() });
  }
  await localEnsure(workspace);
  return readLocalPortal(workspace);
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
  if (document.version !== (previous?.version ?? 0)) throw new PortalError('Hồ sơ đã thay đổi ở nơi khác. Tải lại dữ liệu trước khi lưu.', 409);
  if (kind === 'patient') {
    const p = document as Patient;
    if (data.patients.some(other => other.id !== p.id && other.medical_record_number.toLowerCase() === p.medical_record_number.toLowerCase())) throw new PortalError('Mã bệnh nhân đã tồn tại.', 409);
  }
  if (kind === 'encounter') {
    const e = document as Encounter;
    if (!data.patients.some(p => p.id === e.patient_id)) throw new PortalError('Không tìm thấy bệnh nhân trong portal của bạn.', 404);
    if (previous && (previous as Encounter).patient_id !== e.patient_id) throw new PortalError('Không thể chuyển lần khám sang bệnh nhân khác.');
  }
  if (kind === 'feedback') {
    const f = document as Feedback;
    if (f.patient_id && !data.patients.some(p => p.id === f.patient_id)) throw new PortalError('Không tìm thấy bệnh nhân được góp ý.', 404);
    if (f.encounter_id && !data.encounters.some(e => e.id === f.encounter_id && (!f.patient_id || e.patient_id === f.patient_id))) throw new PortalError('Không tìm thấy lần khám được góp ý.', 404);
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
  if (results[0].meta.changes !== 1) throw new PortalError('Có người vừa cập nhật hồ sơ này. Tải lại để tránh ghi đè.', 409);
  return saved;
}

export async function readBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new PortalError('Cần gửi dữ liệu JSON.', 415);
  const raw = await request.text();
  if (raw.length > 150000) throw new PortalError('Hồ sơ quá lớn. Hãy rút ngắn nội dung.', 413);
  try { return JSON.parse(raw); } catch { throw new PortalError('Nội dung JSON không hợp lệ.'); }
}
export function portalError(error: unknown): Response {
  const known = error instanceof PortalError;
  return Response.json({ error: known ? error.message : 'Không thể xử lý hồ sơ lúc này. Vui lòng thử lại.' }, { status: known ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
}
export function portalJson(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Vary': 'oai-authenticated-user-id' } });
}
