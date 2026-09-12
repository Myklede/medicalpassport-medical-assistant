import { isClinicalBrief, validationMessage, MAX_WOUND_IMAGE_BYTES, WoundApiError, type ClinicalBrief } from './wound-api';

export const WOUND_SESSION_API = 'http://127.0.0.1:8000/api/wound-sessions';
export type WoundSession = {
  session_id: string; patient_id: string; patient_profile: Record<string, unknown>;
  created_at: string; storage_provider: 'local_sqlite'; baseline_locked: boolean;
  visits: { visit_id: string; day: number; timestamp: string; image_path: string }[];
  brief: ClinicalBrief | null;
};

function validId(id: string) {
  if (!/^[0-9a-f]{32}$/.test(id)) throw new WoundApiError('Mã đợt theo dõi không hợp lệ.');
  return id;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function request(path: string, patientId: string, form?: FormData): Promise<WoundSession> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(WOUND_SESSION_API + path, { method: form ? 'POST' : 'GET', body: form, signal: controller.signal, cache: 'no-store' });
    const payload: unknown = await response.json();
    if (!response.ok) throw new WoundApiError(validationMessage(payload) || `HTTP ${response.status}`, response.status);
    if (!record(payload) || typeof payload.session_id !== 'string'
        || !/^[0-9a-f]{32}$/.test(payload.session_id) || payload.patient_id !== patientId
        || (path && payload.session_id !== path.split('/')[1]) || typeof payload.created_at !== 'string'
        || payload.storage_provider !== 'local_sqlite' || payload.baseline_locked !== true
        || !record(payload.patient_profile) || payload.patient_profile.patient_id !== patientId
        || !Array.isArray(payload.visits) || (payload.brief !== null && !isClinicalBrief(payload.brief))) {
      throw new WoundApiError('Đợt theo dõi không khớp bệnh nhân hoặc dữ liệu không hợp lệ.');
    }
    if (payload.brief && payload.brief.patient_id !== patientId) throw new WoundApiError('Kết quả không khớp bệnh nhân.');
    for (const visit of payload.visits) {
      if (!record(visit) || typeof visit.visit_id !== 'string' || !/^[0-9a-f]{32}$/.test(visit.visit_id)
          || typeof visit.day !== 'number' || !Number.isFinite(visit.day) || visit.day < 0 || typeof visit.timestamp !== 'string'
          || visit.image_path !== `/api/wound-sessions/${payload.session_id}/visits/${visit.visit_id}/image`) {
        throw new WoundApiError('Dữ liệu lần chụp không hợp lệ.');
      }
    }
    return payload as WoundSession;
  } catch (error) {
    if (error instanceof WoundApiError) throw error;
    throw new WoundApiError(controller.signal.aborted
      ? 'Yêu cầu quá 60 giây. Tải lại đợt theo dõi trước khi thử gửi lại.'
      : 'Không đọc được dịch vụ theo dõi tại 127.0.0.1:8000. Kiểm tra máy chủ Python.');
  } finally { clearTimeout(timer); }
}

export function createWoundSession(profile: { patient_id: string; [key: string]: unknown }) {
  const form = new FormData();
  form.append('patient_data', JSON.stringify(profile));
  return request('', profile.patient_id, form);
}
export function getWoundSession(id: string, patientId: string) {
  return request(`/${validId(id)}`, patientId);
}
export function appendWoundVisit(id: string, patientId: string, image: File, day: number,
  options: { timestamp?: string; pixelsPerCm?: number; includePipelineVisuals?: boolean } = {}) {
  if (!['image/png', 'image/jpeg'].includes(image.type) || !image.size || image.size > MAX_WOUND_IMAGE_BYTES) throw new WoundApiError('Chọn PNG/JPEG tối đa 8 MiB.');
  if (!Number.isFinite(day) || day < 0) throw new WoundApiError('Ngày theo dõi phải từ 0 trở lên.');
  const form = new FormData();
  form.append('image', image); form.append('patient_id', patientId); form.append('day', String(day));
  if (options.timestamp) form.append('timestamp', options.timestamp);
  if (options.pixelsPerCm !== undefined) {
    if (!Number.isFinite(options.pixelsPerCm) || options.pixelsPerCm <= 0 || options.pixelsPerCm > 100000) throw new WoundApiError('Thước ảnh phải lớn hơn 0 pixel/cm.');
    form.append('pixels_per_cm', String(options.pixelsPerCm));
  }
  if (options.includePipelineVisuals) form.append('include_pipeline_visuals', 'true');
  return request(`/${validId(id)}/visits`, patientId, form);
}
