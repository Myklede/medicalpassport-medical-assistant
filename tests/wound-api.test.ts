import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { analyzeWound, WOUND_API_URL, WoundApiError } from '../lib/wound-api.ts';
import { MOCK_WOUND_PATIENTS, PATIENT_MODE_PROFILE, woundBaseline } from '../lib/wound-patients.ts';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const file = () => new File(['synthetic test bytes'], 'wound.png', { type: 'image/png' });
const baseline = { patient_id: 'TEST', age: 62, hba1c_level: 9.2, blood_type: 'O+', has_diabetes_type_2: true, hypertension: false };
const brief = {
  objective_measurements: { visits: [{ day: 0, tissue_percentages: { necrotic: 20, slough: 30, granulation: 50 }, risk_deterioration_score: 0.4 }], trajectory_available: false },
  multimodal_context_analysis: 'Research context', system_recommendation: 'Manual review',
};

void test('sends the exact multipart fields and preserves the parsed brief', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, WOUND_API_URL);
    assert.equal(init?.method, 'POST');
    assert.equal(init?.headers, undefined, 'browser must supply the multipart boundary');
    const form = init?.body as FormData;
    assert.equal((form.get('image') as File).name, 'wound.png');
    assert.deepEqual(JSON.parse(form.get('patient_data') as string), baseline);
    assert.equal(form.get('day'), '7');
    assert.equal(form.has('include_pipeline_visuals'), false);
    return Response.json(brief);
  };
  assert.deepEqual(await analyzeWound(file(), baseline, 7), brief);
});

void test('opts into pipeline visuals without changing the original brief', async () => {
  const extended = { ...brief, pipeline_visuals: { status: 'unavailable', original_image: 'YWJj', unet_segmentation_mask: null, tissue_analysis_overlay: null } };
  globalThis.fetch = async (_url, init) => {
    assert.equal((init!.body as FormData).get('include_pipeline_visuals'), 'true');
    return Response.json(extended);
  };
  assert.deepEqual(await analyzeWound(file(), baseline, 0, { includePipelineVisuals: true }), extended);
});

void test('five immutable demo profiles expose only baseline fields to inference', () => {
  assert.equal(MOCK_WOUND_PATIENTS.length, 5);
  assert.equal(new Set(MOCK_WOUND_PATIENTS.map(p => p.patient_id)).size, 5);
  assert.equal(new Set(MOCK_WOUND_PATIENTS.map(p => p.blood_type)).size, 5);
  assert.ok(MOCK_WOUND_PATIENTS.some(p => !p.has_diabetes_type_2));
  assert.ok(MOCK_WOUND_PATIENTS.some(p => p.has_diabetes_type_2 && p.hba1c_level > 8));
  for (const patient of MOCK_WOUND_PATIENTS) {
    assert.ok(Object.isFrozen(patient));
    assert.deepEqual(Object.keys(woundBaseline(patient)).sort(), ['patient_id', 'age', 'blood_type', 'hba1c_level', 'has_diabetes_type_2', 'hypertension', 'fpg_mg_dl', 'peripheral_vascular_status', 'neuropathy_status'].sort());
    assert.equal(patient.clinical_visits.length, 4);
    assert.ok(Object.isFrozen(patient.clinical_visits));
    assert.ok(patient.clinical_visits.every(visit => Object.isFrozen(visit) && Object.isFrozen(visit.measurements)));
  }
  assert.equal(PATIENT_MODE_PROFILE.patient_id, 'SYN000014');
});

void test('defaults to day zero and accepts quality abstention with null estimates', async () => {
  const abstention = { ...brief, objective_measurements: { visits: [{ day: 0, tissue_percentages: null, risk_deterioration_score: null }], trajectory_available: false } };
  globalThis.fetch = async (_url, init) => {
    assert.equal((init!.body as FormData).get('day'), '0');
    return Response.json(abstention);
  };
  assert.deepEqual(await analyzeWound(file(), baseline), abstention);
});

void test('formats FastAPI 422 locations/messages without exposing submitted inputs', async () => {
  globalThis.fetch = async () => Response.json({ detail: [{ loc: ['body', 'day'], msg: 'Must be nonnegative', input: 'PRIVATE-DATA' }] }, { status: 422 });
  await assert.rejects(analyzeWound(file(), baseline), (error: unknown) => {
    assert.ok(error instanceof WoundApiError);
    assert.equal(error.status, 422);
    assert.equal(error.message, 'day: Must be nonnegative');
    assert.ok(!error.message.includes('PRIVATE-DATA'));
    return true;
  });
});

void test('preserves backend string errors and HTTP status', async () => {
  globalThis.fetch = async () => Response.json({ detail: 'Model checkpoint unavailable' }, { status: 503 });
  await assert.rejects(analyzeWound(file(), baseline), { name: 'WoundApiError', message: 'Model checkpoint unavailable', status: 503 });
});

void test('handles a non-JSON server error', async () => {
  globalThis.fetch = async () => new Response('<html>Bad gateway</html>', { status: 502 });
  await assert.rejects(analyzeWound(file(), baseline), { status: 502, message: 'Máy chủ báo lỗi HTTP 502.' });
});

void test('handles network failures with an actionable local-server message', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(analyzeWound(file(), baseline), /127\.0\.0\.1:8000/);
});

void test('rejects malformed success payloads instead of inventing metrics', async () => {
  for (const payload of [{}, { ...brief, objective_measurements: { visits: [], trajectory_available: false } }, {
    ...brief, objective_measurements: { visits: [{ day: 0, tissue_percentages: { necrotic: 90, slough: 90, granulation: 90 }, risk_deterioration_score: 0.4 }], trajectory_available: false },
  }]) {
    globalThis.fetch = async () => Response.json(payload);
    await assert.rejects(analyzeWound(file(), baseline), /Clinical Brief/);
  }
});

void test('rejects unsupported files and invalid days before a request', async () => {
  globalThis.fetch = async () => { throw new Error('Must not fetch'); };
  await assert.rejects(analyzeWound(new File(['x'], 'a.pdf', { type: 'application/pdf' }), baseline), /PNG/);
  await assert.rejects(analyzeWound(new File([], 'a.png', { type: 'image/png' }), baseline), /trống/);
  await assert.rejects(analyzeWound(new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' }), baseline), /8 MiB/);
  await assert.rejects(analyzeWound(file(), baseline, -1), /Ngày/);
  await assert.rejects(analyzeWound(file(), baseline, NaN), /Ngày/);
});
