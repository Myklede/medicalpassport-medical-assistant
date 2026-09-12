export const WOUND_API_URL = 'http://127.0.0.1:8000/api/analyze-wound';
export const MAX_WOUND_IMAGE_BYTES = 8 * 1024 * 1024;

export type TissueComposition = { necrotic: number; slough: number; granulation: number };
export type PipelineVisuals = {
  original_image?: unknown; original_mime_type?: unknown;
  unet_segmentation_mask?: unknown; tissue_analysis_overlay?: unknown;
  status?: unknown; reason?: unknown; note?: unknown; model?: unknown;
  [key: string]: unknown;
};
export type WoundVisit = {
  day: number;
  tissue_percentages: TissueComposition | null;
  risk_deterioration_score: number | null;
  quality?: unknown;
  image_name?: unknown;
  [key: string]: unknown;
};
export type ClinicalBrief = {
  objective_measurements: {
    visits: WoundVisit[];
    trajectory_available: boolean;
    [key: string]: unknown;
  };
  multimodal_context_analysis: string;
  system_recommendation: string;
  pipeline_visuals?: PipelineVisuals;
  [key: string]: unknown;
};

export class WoundApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'WoundApiError';
    this.status = status;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validationMessage(payload: unknown): string | undefined {
  if (!record(payload)) return;
  if (typeof payload.detail === 'string') return payload.detail;
  // FastAPI 422 uses [{loc: ['body', 'day'], msg: '...'}]. Never stringify
  // the entire error: it can include the submitted patient JSON in `input`.
  if (Array.isArray(payload.detail)) {
    const messages = payload.detail.filter(record).map(issue => {
      const field = Array.isArray(issue.loc)
        ? issue.loc.filter(value => (typeof value === 'string' || typeof value === 'number') && value !== 'body').join('.')
        : '';
      return typeof issue.msg === 'string' ? `${field ? `${field}: ` : ''}${issue.msg}` : '';
    }).filter(Boolean);
    if (messages.length) return messages.join('; ');
  }
}

export function isClinicalBrief(value: unknown): value is ClinicalBrief {
  if (!record(value) || !record(value.objective_measurements)
      || typeof value.multimodal_context_analysis !== 'string'
      || typeof value.system_recommendation !== 'string') return false;
  const measurements = value.objective_measurements;
  if (typeof measurements.trajectory_available !== 'boolean'
      || !Array.isArray(measurements.visits) || !measurements.visits.length) return false;
  return measurements.visits.every(visit => {
    if (!record(visit) || typeof visit.day !== 'number' || !Number.isFinite(visit.day) || visit.day < 0) return false;
    const score = visit.risk_deterioration_score;
    if (score !== null && (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1)) return false;
    const tissue = visit.tissue_percentages;
    if (tissue === null) return true;
    if (!record(tissue)) return false;
    const values = ['necrotic', 'slough', 'granulation'].map(key => tissue[key]);
    if (!values.every((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0 && entry <= 100)) return false;
    const unknown = visit.measurement_source === 'binary_wound_mask_v2' ? visit.unclassified_percentage : 0;
    return typeof unknown === 'number' && Number.isFinite(unknown) && unknown >= 0 && unknown <= 100
      && Math.abs(values.reduce((sum, entry) => sum + entry, 0) + unknown - 100) < 0.1;
  });
}

export async function analyzeWound(imageFile: File, patientData: object, day: number = 0,
  options: { includePipelineVisuals?: boolean; pixelsPerCm?: number } = {}): Promise<ClinicalBrief> {
  if (!['image/png', 'image/jpeg'].includes(imageFile.type)) throw new WoundApiError('Vui lòng chọn ảnh PNG hoặc JPEG.');
  if (!imageFile.size) throw new WoundApiError('Tệp ảnh đang trống.');
  if (imageFile.size > MAX_WOUND_IMAGE_BYTES) throw new WoundApiError('Ảnh vượt quá giới hạn 8 MiB.');
  if (!Number.isFinite(day) || day < 0) throw new WoundApiError('Ngày theo dõi phải là số từ 0 trở lên.');
  const form = new FormData();
  form.append('image', imageFile);
  form.append('patient_data', JSON.stringify(patientData));
  form.append('day', String(day));
  // Default callers keep the original three-field request and response contract.
  if (options.includePipelineVisuals) form.append('include_pipeline_visuals', 'true');
  if (options.pixelsPerCm !== undefined) {
    if (!Number.isFinite(options.pixelsPerCm) || options.pixelsPerCm <= 0 || options.pixelsPerCm > 100000) throw new WoundApiError('Thước ảnh phải là số pixel/cm lớn hơn 0.');
    form.append('pixels_per_cm', String(options.pixelsPerCm));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    // The browser supplies the multipart boundary; do not set Content-Type.
    const response = await fetch(WOUND_API_URL, { method: 'POST', body: form, signal: controller.signal });
    let payload: unknown;
    try { payload = await response.json(); } catch {
      if (controller.signal.aborted) throw new WoundApiError('Phân tích quá 60 giây. Hãy thử lại khi máy chủ sẵn sàng.');
      throw new WoundApiError(response.ok ? 'Máy chủ trả về dữ liệu không hợp lệ.' : `Máy chủ báo lỗi HTTP ${response.status}.`, response.status);
    }
    if (!response.ok) {
      const fallback = response.status === 503
        ? 'Mô hình chưa sẵn sàng. Kiểm tra checkpoint của máy chủ Python.'
        : `Phân tích thất bại (HTTP ${response.status}).`;
      throw new WoundApiError(validationMessage(payload) || fallback, response.status);
    }
    if (!isClinicalBrief(payload)) throw new WoundApiError('Kết quả thiếu dữ liệu hoặc không đúng định dạng Clinical Brief.');
    return payload;
  } catch (error) {
    if (error instanceof WoundApiError) throw error;
    if (controller.signal.aborted) throw new WoundApiError('Phân tích quá 60 giây. Hãy thử lại khi máy chủ sẵn sàng.');
    throw new WoundApiError('Không kết nối được dịch vụ phân tích tại 127.0.0.1:8000. Hãy chạy aimedic/main.py trên cùng máy và kiểm tra CORS.');
  } finally {
    clearTimeout(timer);
  }
}
