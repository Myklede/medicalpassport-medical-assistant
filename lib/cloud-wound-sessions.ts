import { env } from 'cloudflare:workers';

import hostedDemo from '@/lib/hosted-wound-demo.json';
import type { ClinicalBrief, PipelineVisuals, WoundVisit } from '@/lib/wound-api';

const COOKIE_NAME = 'medipass_wound_demo';
const ID_PATTERN = /^[0-9a-f]{32}$/;
const PATIENT_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SAMPLE_HASH = 'fcbbae5f676e0160560eaf7ef7f993e8346a4c4cc647836f7467531ff7872764';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const STORAGE_PROVIDER = 'cloud_d1_r2' as const;

type JsonRecord = Record<string, unknown>;
type SessionRow = {
  id: string;
  patient_id: string;
  profile_json: string;
  created_at: string;
};
type VisitRow = {
  id: string;
  session_id: string;
  day: number;
  captured_at: string;
  image_object_key: string;
  mime_type: string;
  byte_size: number;
  image_sha256: string;
  measurement_json: string;
  provenance_json: string;
  pipeline_visuals_json: string | null;
  analysis_status: string;
  analysis_message: string | null;
  created_at: string;
};

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function randomId() {
  return crypto.randomUUID().replaceAll('-', '');
}

function jsonRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function visitor(request: Request) {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([0-9a-f]{32})(?:;|$)`));
  if (match) return { id: match[1], created: false };
  return { id: randomId(), created: true };
}

function responseCookie(request: Request, visitorId: string) {
  return `${COOKIE_NAME}=${visitorId}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}

function withVisitor(request: Request, visitorState: { id: string; created: boolean }, response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  if (visitorState.created) response.headers.append('Set-Cookie', responseCookie(request, visitorState.id));
  return response;
}

function json(request: Request, visitorState: { id: string; created: boolean }, body: unknown, status = 200) {
  return withVisitor(request, visitorState, Response.json(body, { status }));
}

function validateProfile(raw: FormDataEntryValue | null) {
  if (typeof raw !== 'string' || raw.length > 16_384) throw new ApiError(422, 'Invalid patient_data.');
  let profile: unknown;
  try {
    profile = JSON.parse(raw);
  } catch {
    throw new ApiError(422, 'Invalid patient_data.');
  }
  if (!jsonRecord(profile) || typeof profile.patient_id !== 'string' || !PATIENT_PATTERN.test(profile.patient_id)
      || typeof profile.age !== 'number' || !Number.isFinite(profile.age) || profile.age < 0 || profile.age > 130
      || typeof profile.hba1c_level !== 'number' || !Number.isFinite(profile.hba1c_level) || profile.hba1c_level < 0 || profile.hba1c_level > 30
      || typeof profile.blood_type !== 'string' || profile.blood_type.length > 10
      || typeof profile.has_diabetes_type_2 !== 'boolean' || typeof profile.hypertension !== 'boolean') {
    throw new ApiError(422, 'Invalid patient_data: provide the fixed synthetic Wound Lab baseline.');
  }
  return profile;
}

function exactHostedSampleProfile(profile: JsonRecord) {
  return profile.patient_id === 'SYN000014'
    && profile.age === 20
    && profile.blood_type === 'A-'
    && profile.hba1c_level === 9.6
    && profile.has_diabetes_type_2 === true
    && profile.hypertension === false
    && profile.fpg_mg_dl === 218
    && profile.peripheral_vascular_status === 'impaired'
    && profile.neuropathy_status === 'present';
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function detectedMime(bytes: ArrayBuffer, declared: string) {
  const data = new Uint8Array(bytes);
  const png = data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e
    && data[3] === 0x47 && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a;
  const jpeg = data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const detected = png ? 'image/png' : jpeg ? 'image/jpeg' : '';
  if (!detected) throw new ApiError(415, 'File contents are not a PNG or JPEG image.');
  if (declared !== detected) throw new ApiError(415, 'Image contents do not match the declared content type.');
  return detected;
}

function numberField(form: FormData, name: string, options: { optional?: boolean; max?: number } = {}) {
  const raw = form.get(name);
  if ((raw === null || raw === '') && options.optional) return undefined;
  if (typeof raw !== 'string') throw new ApiError(422, `${name} is required.`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || (options.max !== undefined && value > options.max)) {
    throw new ApiError(422, `${name} is invalid.`);
  }
  return value;
}

function hostedMeasurement(day: number, imageHash: string, form: FormData) {
  const brief = clone(hostedDemo) as unknown as ClinicalBrief;
  const visit = brief.objective_measurements.visits[0];
  visit.day = day;
  visit.image_sha256 = imageHash;
  visit.image_name = 'synthetic-wound-sample.png';
  visit.analysis_status = 'completed';
  visit.capture_conditions_consistent = form.get('capture_conditions_consistent') === 'true';
  visit.pixels_per_cm = numberField(form, 'pixels_per_cm', { optional: true, max: 100_000 }) ?? null;
  if (jsonRecord(brief.pipeline_visuals)) brief.pipeline_visuals.day = day;
  return { brief, visit, visuals: brief.pipeline_visuals ?? null };
}

function pendingBrief(profile: JsonRecord, visit: WoundVisit): ClinicalBrief {
  const en = {
    simple_explanation: 'The image is securely saved, but this public demo did not run a model on it. No tissue, area, risk, or healing result has been inferred.',
    baseline_context: `The locked synthetic profile records HbA1c ${String(profile.hba1c_level)}% and type 2 diabetes ${profile.has_diabetes_type_2 === true ? 'present' : 'not recorded as present'}.`,
    why_this_matters: 'A photo can miss depth, circulation problems, infection, and other findings that require direct examination.',
    possible_consequences: 'No conclusion about healing or deterioration can be drawn from an unprocessed image.',
    what_to_do: [{ action_id: 'use_sample', text: 'For the hosted AI walkthrough, start a new session and choose “Load hosted AI sample”.' }],
    when_to_seek_care: 'Seek urgent medical assessment for severe bleeding, rapidly spreading redness, fever, loss of feeling or function, visible deep structures, or other concerning symptoms.',
    safety_note: 'Research prototype only. Do not use this result to diagnose, delay care, or change treatment.',
  };
  const vi = {
    simple_explanation: 'Ảnh đã được lưu an toàn, nhưng bản demo công khai này chưa chạy mô hình trên ảnh đó. Hệ thống không suy ra mô, diện tích, nguy cơ hay mức lành thương.',
    baseline_context: `Hồ sơ tổng hợp cố định ghi HbA1c ${String(profile.hba1c_level)}% và đái tháo đường type 2 ${profile.has_diabetes_type_2 === true ? 'đã ghi nhận' : 'chưa ghi nhận'}.`,
    why_this_matters: 'Một tấm ảnh có thể bỏ sót độ sâu, tuần hoàn, nhiễm trùng và các dấu hiệu cần khám trực tiếp.',
    possible_consequences: 'Không thể kết luận lành thương hay xấu đi từ một ảnh chưa được mô hình xử lý.',
    what_to_do: [{ action_id: 'use_sample', text: 'Để thử AI trên web, hãy tạo phiên mới và chọn “Load hosted AI sample”.' }],
    when_to_seek_care: 'Cần được đánh giá y tế khẩn cấp nếu chảy máu nhiều, đỏ lan nhanh, sốt, mất cảm giác/chức năng, thấy cấu trúc sâu hoặc có dấu hiệu đáng lo khác.',
    safety_note: 'Chỉ là nguyên mẫu nghiên cứu. Không dùng kết quả này để chẩn đoán, trì hoãn khám hoặc thay đổi điều trị.',
  };
  const reason = 'Image saved in cloud storage. Hosted inference is enabled only for the exact bundled synthetic sample; no estimate was fabricated for this upload.';
  return {
    brief_schema_version: 'pwc-research-brief-v2',
    patient_id: profile.patient_id,
    research_only: true,
    clinical_use_allowed: false,
    requires_clinician_review: true,
    objective_measurements: { visits: [visit], trajectory_available: false, interval_changes: [], overall_change: null },
    multimodal_context_analysis: reason,
    system_recommendation: 'Use the bundled synthetic sample for the hosted model walkthrough, or run the verified Python service locally for research-only arbitrary-image inference.',
    research_review_priority: 'insufficient_data',
    risk_alerts: [],
    uncertainty: { calibrated: false, confidence_interval: null, note: 'No hosted model inference was run.' },
    limitations: ['No image inference was performed for this upload.', 'The hosted model walkthrough is limited to the bundled synthetic fixture.'],
    provenance: { model_version: 'hosted-sample-gate-v1', model_inference_completed: false, input_source: 'cloud_saved_capture' },
    patient_explanation: { schema_version: 'pwc-patient-explanation-v1', locales: { en, vi }, evidence_ids: [] },
    pipeline_visuals: {
      schema_version: 'pwc-pipeline-visuals-v1', day: visit.day, original_image: null,
      original_mime_type: null, unet_segmentation_mask: null, tissue_analysis_overlay: null,
      derived_mime_type: 'image/png', status: 'unavailable', reason, clinical_validation: false,
    },
  } as ClinicalBrief;
}

function pendingMeasurement(day: number, imageHash: string, form: FormData): WoundVisit {
  const message = 'Saved to the hosted Wound Lab. No model result was generated: public inference is limited to the bundled synthetic sample.';
  return {
    day,
    image_name: 'uploaded-capture',
    image_sha256: imageHash,
    analysis_status: 'pending_model',
    analysis_message: message,
    measurement_source: 'pending_model',
    measurement_status: 'unavailable',
    tissue_percentages: null,
    risk_deterioration_score: null,
    area_cm2: null,
    wound_area_pixels: null,
    unclassified_percentage: null,
    pixels_per_cm: numberField(form, 'pixels_per_cm', { optional: true, max: 100_000 }) ?? null,
    capture_conditions_consistent: form.get('capture_conditions_consistent') === 'true',
    clinical_observations: {},
    quality: { assessment_status: 'not_assessed', issues: [message] },
  };
}

async function getSession(sessionId: string, visitorId: string, patientId?: string) {
  if (!ID_PATTERN.test(sessionId)) throw new ApiError(404, 'Wound session not found.');
  const row = await env.DB.prepare(
    `SELECT id, patient_id, profile_json, created_at FROM wound_lab_sessions
     WHERE id = ? AND visitor_id = ?`,
  ).bind(sessionId, visitorId).first<SessionRow>();
  if (!row || (patientId !== undefined && row.patient_id !== patientId)) {
    throw new ApiError(404, 'Wound session not found for this browser and patient.');
  }
  return row;
}

async function getVisits(sessionId: string, throughDay?: number) {
  const suffix = throughDay === undefined ? '' : ' AND day <= ?';
  const statement = env.DB.prepare(
    `SELECT id, session_id, day, captured_at, image_object_key, mime_type, byte_size,
            image_sha256, measurement_json, provenance_json, pipeline_visuals_json,
            analysis_status, analysis_message, created_at
     FROM wound_lab_visits WHERE session_id = ?${suffix} ORDER BY day ASC`,
  );
  const result = throughDay === undefined
    ? await statement.bind(sessionId).all<VisitRow>()
    : await statement.bind(sessionId, throughDay).all<VisitRow>();
  return result.results;
}

function briefFor(profile: JsonRecord, rows: VisitRow[]) {
  if (!rows.length) return null;
  const selected = rows.at(-1)!;
  const visits = rows.map(row => parseJson<WoundVisit>(row.measurement_json, {
    day: row.day, tissue_percentages: null, risk_deterioration_score: null,
  }));
  let brief: ClinicalBrief;
  if (selected.analysis_status === 'completed') {
    brief = clone(hostedDemo) as unknown as ClinicalBrief;
  } else {
    brief = pendingBrief(profile, visits.at(-1)!);
  }
  brief.patient_id = String(profile.patient_id);
  brief.objective_measurements.visits = visits;
  brief.objective_measurements.trajectory_available = false;
  brief.objective_measurements.interval_changes = [];
  brief.objective_measurements.overall_change = null;
  brief.objective_measurements.latest_change = null;
  const visuals = selected.pipeline_visuals_json
    ? parseJson<PipelineVisuals | null>(selected.pipeline_visuals_json, null)
    : null;
  if (visuals) brief.pipeline_visuals = visuals;
  else delete brief.pipeline_visuals;
  return brief;
}

async function snapshot(session: SessionRow) {
  const profile = parseJson<JsonRecord>(session.profile_json, {});
  const rows = await getVisits(session.id);
  return {
    session_id: session.id,
    patient_id: session.patient_id,
    patient_profile: profile,
    created_at: session.created_at,
    storage_provider: STORAGE_PROVIDER,
    baseline_locked: true,
    visits: rows.map(row => ({
      visit_id: row.id,
      day: row.day,
      timestamp: row.captured_at,
      analysis_status: row.analysis_status,
      analysis_message: row.analysis_message,
      image_path: `/api/wound-sessions/${session.id}/visits/${row.id}/image`,
    })),
    brief: briefFor(profile, rows),
  };
}

async function listSessions(request: Request, visitorState: { id: string; created: boolean }, url: URL) {
  const patientId = url.searchParams.get('patient_id') ?? '';
  if (!PATIENT_PATTERN.test(patientId)) throw new ApiError(422, 'A valid patient_id is required.');
  const result = await env.DB.prepare(
    `SELECT s.id, s.patient_id, s.created_at, COUNT(v.id) AS visit_count,
            MAX(v.day) AS latest_day, COALESCE(MAX(v.captured_at), s.created_at) AS updated_at
     FROM wound_lab_sessions s LEFT JOIN wound_lab_visits v ON v.session_id = s.id
     WHERE s.visitor_id = ? AND s.patient_id = ?
     GROUP BY s.id ORDER BY updated_at DESC, s.created_at DESC`,
  ).bind(visitorState.id, patientId).all<{
    id: string; patient_id: string; created_at: string; visit_count: number;
    latest_day: number | null; updated_at: string;
  }>();
  return json(request, visitorState, {
    storage_provider: STORAGE_PROVIDER,
    sessions: result.results.map(row => ({
      session_id: row.id,
      patient_id: row.patient_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      visit_count: row.visit_count,
      latest_day: row.latest_day,
      storage_provider: STORAGE_PROVIDER,
      baseline_locked: true,
    })),
  });
}

async function createSession(request: Request, visitorState: { id: string; created: boolean }) {
  const form = await request.formData();
  const profile = validateProfile(form.get('patient_data'));
  const id = randomId();
  const createdAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO wound_lab_sessions (id, visitor_id, patient_id, profile_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(id, visitorState.id, profile.patient_id, JSON.stringify(profile), createdAt).run();
  return json(request, visitorState, await snapshot({
    id, patient_id: String(profile.patient_id), profile_json: JSON.stringify(profile), created_at: createdAt,
  }), 201);
}

async function addVisit(request: Request, visitorState: { id: string; created: boolean }, sessionId: string) {
  const form = await request.formData();
  const patientId = form.get('patient_id');
  if (typeof patientId !== 'string' || !PATIENT_PATTERN.test(patientId)) throw new ApiError(422, 'A valid patient_id is required.');
  const session = await getSession(sessionId, visitorState.id, patientId);
  const profile = parseJson<JsonRecord>(session.profile_json, {});
  const image = form.get('image');
  if (!(image instanceof File)) throw new ApiError(422, 'Choose a PNG or JPEG image.');
  if (!image.size || image.size > MAX_IMAGE_BYTES) throw new ApiError(413, 'The image must be between 1 byte and 8 MiB.');
  const bytes = await image.arrayBuffer();
  const mime = detectedMime(bytes, image.type);
  const imageHash = await sha256(bytes);
  const day = numberField(form, 'day', { max: 36_500 })!;
  const timestampRaw = form.get('timestamp');
  const capturedAt = typeof timestampRaw === 'string' && timestampRaw ? new Date(timestampRaw) : new Date();
  if (!Number.isFinite(capturedAt.getTime()) || capturedAt.getTime() > Date.now() + 60_000) {
    throw new ApiError(422, 'timestamp must be a valid time that is not in the future.');
  }
  const capturedIso = capturedAt.toISOString();
  const existing = await getVisits(sessionId);
  if (existing.length >= 1_000) throw new ApiError(409, 'This session has reached 1,000 captures.');
  const last = existing.at(-1);
  if (last && (day <= last.day || capturedIso <= last.captured_at)) {
    throw new ApiError(409, 'Visit day and timestamp must be later than the last stored capture.');
  }
  if (existing.some(row => row.image_sha256 === imageHash)) {
    throw new ApiError(409, 'This image is already stored in the session; upload a new capture.');
  }

  const visitId = randomId();
  const isHostedDemo = imageHash === SAMPLE_HASH && exactHostedSampleProfile(profile);
  const analyzed = isHostedDemo
    ? hostedMeasurement(day, imageHash, form)
    : (() => {
        const visit = pendingMeasurement(day, imageHash, form);
        const brief = pendingBrief(profile, visit);
        return { brief, visit, visuals: brief.pipeline_visuals ?? null };
      })();
  analyzed.visit.timestamp = capturedIso;
  analyzed.visit.timestamp_source = timestampRaw ? 'caller_capture' : 'server_received';
  analyzed.visit.visit_id = visitId;
  const status = isHostedDemo ? 'completed' : 'pending_model';
  const analysisMessage = typeof analyzed.visit.analysis_message === 'string' ? analyzed.visit.analysis_message : null;
  const extension = mime === 'image/png' ? 'png' : 'jpg';
  const objectKey = `wound-lab/${visitorState.id}/${sessionId}/${visitId}.${extension}`;

  await env.FILES.put(objectKey, bytes, {
    httpMetadata: { contentType: mime },
    customMetadata: { purpose: 'hosted-wound-lab-demo', sessionId, visitId },
  });
  try {
    await env.DB.prepare(
      `INSERT INTO wound_lab_visits
       (id, session_id, day, captured_at, image_object_key, mime_type, byte_size,
        image_sha256, measurement_json, provenance_json, pipeline_visuals_json,
        analysis_status, analysis_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      visitId, sessionId, day, capturedIso, objectKey, mime, image.size, imageHash,
      JSON.stringify(analyzed.visit), JSON.stringify(analyzed.brief.provenance ?? {}),
      analyzed.visuals ? JSON.stringify(analyzed.visuals) : null,
      status, analysisMessage, new Date().toISOString(),
    ).run();
  } catch (error) {
    await env.FILES.delete(objectKey).catch(() => undefined);
    throw error;
  }
  return json(request, visitorState, await snapshot(session), 201);
}

async function selectedVisit(session: SessionRow, visitId: string) {
  if (!ID_PATTERN.test(visitId)) throw new ApiError(404, 'Wound visit not found.');
  const row = await env.DB.prepare(
    `SELECT id, session_id, day, captured_at, image_object_key, mime_type, byte_size,
            image_sha256, measurement_json, provenance_json, pipeline_visuals_json,
            analysis_status, analysis_message, created_at
     FROM wound_lab_visits WHERE session_id = ? AND id = ?`,
  ).bind(session.id, visitId).first<VisitRow>();
  if (!row) throw new ApiError(404, 'Wound visit not found.');
  return row;
}

async function getVisit(request: Request, visitorState: { id: string; created: boolean }, session: SessionRow, visitId: string) {
  const row = await selectedVisit(session, visitId);
  const rows = await getVisits(session.id, row.day);
  return json(request, visitorState, {
    session_id: session.id,
    patient_id: session.patient_id,
    visit_id: visitId,
    brief: briefFor(parseJson<JsonRecord>(session.profile_json, {}), rows),
  });
}

async function getImage(request: Request, visitorState: { id: string; created: boolean }, session: SessionRow, visitId: string) {
  const row = await selectedVisit(session, visitId);
  const object = await env.FILES.get(row.image_object_key);
  if (!object) throw new ApiError(404, 'Visit image not found.');
  return withVisitor(request, visitorState, new Response(object.body, {
    headers: { 'Content-Type': row.mime_type, 'Content-Length': String(row.byte_size) },
  }));
}

async function retryVisit(request: Request, visitorState: { id: string; created: boolean }, session: SessionRow, visitId: string) {
  const row = await selectedVisit(session, visitId);
  if (row.analysis_status !== 'pending_model') throw new ApiError(409, 'This capture already has a completed analysis.');
  const profile = parseJson<JsonRecord>(session.profile_json, {});
  if (row.image_sha256 !== SAMPLE_HASH || !exactHostedSampleProfile(profile)) {
    throw new ApiError(409, 'Hosted inference is available only for “Load hosted AI sample”. The saved image remains unchanged.');
  }
  const form = new FormData();
  const previous = parseJson<WoundVisit>(row.measurement_json, { day: row.day, tissue_percentages: null, risk_deterioration_score: null });
  if (typeof previous.pixels_per_cm === 'number' && Number.isFinite(previous.pixels_per_cm)) {
    form.set('pixels_per_cm', String(previous.pixels_per_cm));
  }
  if (previous.capture_conditions_consistent === true) form.set('capture_conditions_consistent', 'true');
  const analyzed = hostedMeasurement(row.day, row.image_sha256, form);
  analyzed.visit.timestamp = row.captured_at;
  analyzed.visit.timestamp_source = previous.timestamp_source ?? 'caller_capture';
  analyzed.visit.visit_id = row.id;
  await env.DB.prepare(
    `UPDATE wound_lab_visits SET measurement_json = ?, provenance_json = ?, pipeline_visuals_json = ?,
            analysis_status = 'completed', analysis_message = NULL WHERE session_id = ? AND id = ?`,
  ).bind(
    JSON.stringify(analyzed.visit), JSON.stringify(analyzed.brief.provenance ?? {}),
    JSON.stringify(analyzed.visuals), session.id, row.id,
  ).run();
  return json(request, visitorState, await snapshot(session));
}

async function deleteVisit(request: Request, visitorState: { id: string; created: boolean }, session: SessionRow, visitId: string) {
  const row = await selectedVisit(session, visitId);
  await env.FILES.delete(row.image_object_key);
  await env.DB.prepare('DELETE FROM wound_lab_visits WHERE session_id = ? AND id = ?').bind(session.id, visitId).run();
  return json(request, visitorState, await snapshot(session));
}

async function deleteSession(request: Request, visitorState: { id: string; created: boolean }, session: SessionRow) {
  const rows = await getVisits(session.id);
  await Promise.all(rows.map(row => env.FILES.delete(row.image_object_key)));
  await env.DB.prepare('DELETE FROM wound_lab_sessions WHERE id = ? AND visitor_id = ?').bind(session.id, visitorState.id).run();
  return json(request, visitorState, { deleted: true, session_id: session.id, deleted_visit_count: rows.length });
}

export async function cloudWoundSession(request: Request): Promise<Response> {
  const visitorState = visitor(request);
  try {
    const url = new URL(request.url);
    if (request.method !== 'GET') {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) throw new ApiError(403, 'The request must come from the same MediPass site.');
    }
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > 9 * 1024 * 1024) throw new ApiError(413, 'The image exceeds the 8 MiB limit.');
    const parts = url.pathname.slice('/api/wound-sessions'.length).split('/').filter(Boolean);
    if (!parts.length) {
      if (request.method === 'GET') return await listSessions(request, visitorState, url);
      if (request.method === 'POST') return await createSession(request, visitorState);
      throw new ApiError(405, 'Method not allowed.');
    }
    const session = await getSession(parts[0], visitorState.id, url.searchParams.get('patient_id') ?? undefined);
    if (parts.length === 1) {
      if (request.method === 'GET') return json(request, visitorState, await snapshot(session));
      if (request.method === 'DELETE') return await deleteSession(request, visitorState, session);
      throw new ApiError(405, 'Method not allowed.');
    }
    if (parts[1] !== 'visits') throw new ApiError(404, 'Tracking route not found.');
    if (parts.length === 2 && request.method === 'POST') return await addVisit(request, visitorState, session.id);
    if (parts.length < 3) throw new ApiError(404, 'Tracking route not found.');
    const visitId = parts[2];
    if (parts.length === 3) {
      if (request.method === 'GET') return await getVisit(request, visitorState, session, visitId);
      if (request.method === 'DELETE') return await deleteVisit(request, visitorState, session, visitId);
    }
    if (parts.length === 4 && parts[3] === 'image' && request.method === 'GET') return await getImage(request, visitorState, session, visitId);
    if (parts.length === 4 && parts[3] === 'analyze' && request.method === 'POST') return await retryVisit(request, visitorState, session, visitId);
    throw new ApiError(404, 'Tracking route not found.');
  } catch (error) {
    if (error instanceof ApiError) return json(request, visitorState, { detail: error.message }, error.status);
    console.error('Hosted Wound Lab request failed', error);
    return json(request, visitorState, { detail: 'The hosted Wound Lab could not complete this request. Saved cloud data is retained.' }, 500);
  }
}
