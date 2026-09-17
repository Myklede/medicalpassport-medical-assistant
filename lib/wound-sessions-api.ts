import { isClinicalBrief, validationMessage, MAX_WOUND_IMAGE_BYTES, WoundApiError, type ClinicalBrief } from './wound-api.ts';
import type { BrowserWoundInference } from './wound-browser-contract.ts';

// The phone talks to the web server, never its own loopback.
export const WOUND_SESSION_API = '/api/wound-sessions';
export type SavedWoundVisit = { visit_id: string; day: number; timestamp: string; image_path: string; analysis_status?: string; analysis_message?: string };
export type WoundSession = {
  session_id: string; patient_id: string; patient_profile: Record<string, unknown>;
  created_at: string; storage_provider: 'local_sqlite' | 'cloud_d1_r2'; baseline_locked: boolean;
  visits: SavedWoundVisit[]; brief: ClinicalBrief | null;
};
export type WoundSessionSummary = {
  session_id: string; patient_id: string; created_at: string; updated_at: string;
  visit_count: number; latest_day: number | null; storage_provider: 'local_sqlite' | 'cloud_d1_r2'; baseline_locked: boolean;
};
const idPattern = /^[0-9a-f]{32}$/;
function validId(id: string) {
  if (!idPattern.test(id)) throw new WoundApiError('Invalid session or capture ID.');
  return id;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const patientQuery = (patientId: string) => '?patient_id=' + encodeURIComponent(patientId);

async function request(path: string, method = 'GET', form?: FormData): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 65_000);
  try {
    const response = await fetch(WOUND_SESSION_API + path, { method, ...(method === 'POST' ? { body: form } : {}), signal: controller.signal, cache: 'no-store' });
    let payload: unknown;
    try { payload = await response.json(); }
    catch { throw new WoundApiError('The service returned invalid data (HTTP ' + response.status + ').', response.status); }
    if (!response.ok) throw new WoundApiError(validationMessage(payload) || 'HTTP ' + response.status, response.status);
    return payload;
  } catch (error) {
    if (error instanceof WoundApiError) throw error;
    throw new WoundApiError(controller.signal.aborted
      ? 'The request timed out. Reload the session to check saved images before trying again.'
      : 'Cannot connect to the hosted Wound Lab. Reload the page; previously saved cloud data is retained.');
  } finally { clearTimeout(timer); }
}

function sessionPayload(payload: unknown, patientId: string, sessionId?: string): WoundSession {
  if (!record(payload) || typeof payload.session_id !== 'string' || !idPattern.test(payload.session_id)
      || (sessionId && payload.session_id !== sessionId) || payload.patient_id !== patientId
      || typeof payload.created_at !== 'string' || !Number.isFinite(Date.parse(payload.created_at))
      || !['local_sqlite', 'cloud_d1_r2'].includes(String(payload.storage_provider)) || payload.baseline_locked !== true
      || !record(payload.patient_profile) || payload.patient_profile.patient_id !== patientId
      || !Array.isArray(payload.visits) || (payload.brief !== null && !isClinicalBrief(payload.brief))) {
    throw new WoundApiError('The tracking session does not match the patient or contains invalid data.');
  }
  const ids = new Set<string>();
  let previousDay = -1;
  let previousTime = -Infinity;
  for (const visit of payload.visits) {
    if (!record(visit) || typeof visit.visit_id !== 'string' || !idPattern.test(visit.visit_id) || ids.has(visit.visit_id)
        || typeof visit.day !== 'number' || !Number.isFinite(visit.day) || visit.day <= previousDay
        || typeof visit.timestamp !== 'string' || !Number.isFinite(Date.parse(visit.timestamp)) || Date.parse(visit.timestamp) <= previousTime
        || visit.image_path !== '/api/wound-sessions/' + payload.session_id + '/visits/' + visit.visit_id + '/image') {
      throw new WoundApiError('Capture data or chronology is invalid.');
    }
    ids.add(visit.visit_id); previousDay = visit.day; previousTime = Date.parse(visit.timestamp);
  }
  if (payload.brief) {
    if (payload.brief.patient_id !== patientId || payload.brief.objective_measurements.visits.length !== payload.visits.length
        || payload.brief.objective_measurements.visits.some((visit, i) => visit.day !== (payload.visits as SavedWoundVisit[])[i].day)) {
      throw new WoundApiError('The result does not match the patient or saved captures.');
    }
  } else if (payload.visits.length) throw new WoundApiError('The tracking session is missing its saved result.');
  return payload as WoundSession;
}

export async function listWoundSessions(patientId: string): Promise<WoundSessionSummary[]> {
  const payload = await request(patientQuery(patientId));
  if (!record(payload) || !['local_sqlite', 'cloud_d1_r2'].includes(String(payload.storage_provider)) || !Array.isArray(payload.sessions)
      || !payload.sessions.every(s => record(s) && typeof s.session_id === 'string' && idPattern.test(s.session_id)
        && s.patient_id === patientId && typeof s.created_at === 'string' && Number.isFinite(Date.parse(s.created_at))
        && typeof s.visit_count === 'number' && Number.isInteger(s.visit_count) && s.visit_count >= 0
        && ['local_sqlite', 'cloud_d1_r2'].includes(String(s.storage_provider)) && s.baseline_locked === true)) {
    throw new WoundApiError('The tracking-session list does not match the patient.');
  }
  return payload.sessions as WoundSessionSummary[];
}
export async function createWoundSession(profile: { patient_id: string; [key: string]: unknown }) {
  const form = new FormData();
  form.append('patient_data', JSON.stringify(profile));
  return sessionPayload(await request('', 'POST', form), profile.patient_id);
}
export async function getWoundSession(id: string, patientId: string) {
  return sessionPayload(await request('/' + validId(id) + patientQuery(patientId)), patientId, id);
}
export async function appendWoundVisit(id: string, patientId: string, image: File, day: number,
  options: { timestamp?: string; pixelsPerCm?: number; includePipelineVisuals?: boolean; captureConditionsConsistent?: boolean; browserInference?: BrowserWoundInference } = {}) {
  if (!['image/png', 'image/jpeg'].includes(image.type) || !image.size || image.size > MAX_WOUND_IMAGE_BYTES) throw new WoundApiError('Choose a PNG/JPEG image up to 8 MiB.');
  if (!Number.isFinite(day) || day < 0) throw new WoundApiError('The tracking day must be zero or greater.');
  const form = new FormData();
  form.append('image', image); form.append('patient_id', patientId); form.append('day', String(day));
  form.append('preserve_on_model_unavailable', 'true');
  if (options.timestamp) {
    if (!Number.isFinite(Date.parse(options.timestamp))) throw new WoundApiError('Invalid capture time.');
    form.append('timestamp', options.timestamp);
  }
  if (options.pixelsPerCm !== undefined) {
    if (!Number.isFinite(options.pixelsPerCm) || options.pixelsPerCm <= 0 || options.pixelsPerCm > 100000) throw new WoundApiError('Image scale must be greater than 0 pixels/cm.');
    form.append('pixels_per_cm', String(options.pixelsPerCm));
  }
  if (options.includePipelineVisuals) form.append('include_pipeline_visuals', 'true');
  if (options.captureConditionsConsistent) form.append('capture_conditions_consistent', 'true');
  if (options.browserInference) form.append('browser_inference', JSON.stringify(options.browserInference));
  return sessionPayload(await request('/' + validId(id) + '/visits', 'POST', form), patientId, id);
}
export async function getWoundVisit(id: string, visitId: string, patientId: string): Promise<ClinicalBrief> {
  const payload = await request('/' + validId(id) + '/visits/' + validId(visitId) + patientQuery(patientId));
  if (!record(payload) || payload.session_id !== id || payload.visit_id !== visitId || payload.patient_id !== patientId
      || !isClinicalBrief(payload.brief) || payload.brief.patient_id !== patientId) throw new WoundApiError('The result does not match the selected capture.');
  return payload.brief;
}
export function woundVisitImageUrl(sessionId: string, visitId: string, patientId: string) {
  return WOUND_SESSION_API + '/' + validId(sessionId) + '/visits/' + validId(visitId) + '/image' + patientQuery(patientId);
}
export async function retryWoundVisit(id: string, visitId: string, patientId: string, browserInference?: BrowserWoundInference) {
  const form = new FormData();
  if (browserInference) form.append('browser_inference', JSON.stringify(browserInference));
  return sessionPayload(await request('/' + validId(id) + '/visits/' + validId(visitId) + '/analyze' + patientQuery(patientId), 'POST', form), patientId, id);
}
export async function deleteWoundVisit(id: string, visitId: string, patientId: string) {
  return sessionPayload(await request('/' + validId(id) + '/visits/' + validId(visitId) + patientQuery(patientId), 'DELETE'), patientId, id);
}
export async function deleteWoundSession(id: string, patientId: string): Promise<void> {
  const payload = await request('/' + validId(id) + patientQuery(patientId), 'DELETE');
  if (!record(payload) || payload.deleted !== true || payload.session_id !== id) throw new WoundApiError('Session deletion could not be confirmed; reload to verify.');
}
