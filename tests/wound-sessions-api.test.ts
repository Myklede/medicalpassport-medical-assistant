import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { appendWoundVisit, deleteWoundSession, getWoundSession, getWoundVisit, listWoundSessions, retryWoundVisit, woundVisitImageUrl } from '../lib/wound-sessions-api.ts';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const sid = 'a'.repeat(32);
const vid = 'b'.repeat(32);
const patient = 'SYN000014';
const snapshot = () => ({
  session_id: sid, patient_id: patient, patient_profile: { patient_id: patient, hba1c_level: 9.6 },
  created_at: '2026-09-01T10:00:00Z', storage_provider: 'local_sqlite', baseline_locked: true,
  visits: [{ visit_id: vid, day: 0, timestamp: '2026-09-01T10:00:00Z', image_path: `/api/wound-sessions/${sid}/visits/${vid}/image` }],
  brief: { patient_id: patient, objective_measurements: { trajectory_available: false, visits: [{ day: 0, tissue_percentages: null, risk_deterioration_score: null }] }, multimodal_context_analysis: 'Saved baseline; model unavailable.', system_recommendation: 'Retry saved capture.' },
});

void test('reload and image requests are same-origin and patient-scoped', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, `/api/wound-sessions/${sid}?patient_id=${patient}`);
    assert.equal(init?.method, 'GET');
    assert.equal(init?.body, undefined);
    assert.equal(init?.cache, 'no-store');
    return Response.json(snapshot());
  };
  assert.equal((await getWoundSession(sid, patient)).visits.length, 1);
  assert.equal(woundVisitImageUrl(sid, vid, patient), `/api/wound-sessions/${sid}/visits/${vid}/image?patient_id=${patient}`);
});

void test('single-image upload retains capture time, locked patient, physical scale and persistence opt-in', async () => {
  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.method, 'POST');
    const form = init!.body as FormData;
    assert.equal(form.get('patient_id'), patient);
    assert.equal(form.get('day'), '0');
    assert.equal(form.get('timestamp'), '2026-09-01T10:00:00Z');
    assert.equal(form.get('pixels_per_cm'), '120');
    assert.equal(form.get('capture_conditions_consistent'), 'true');
    assert.equal(form.get('preserve_on_model_unavailable'), 'true');
    assert.equal(form.has('patient_data'), false, 'append must use the existing server baseline');
    return Response.json(snapshot());
  };
  await appendWoundVisit(sid, patient, new File(['test'], 'test.png', { type: 'image/png' }), 0, {
    timestamp: '2026-09-01T10:00:00Z', pixelsPerCm: 120, captureConditionsConsistent: true,
  });
});

void test('rejects mismatched identity, unsafe image paths and inconsistent brief days', async () => {
  const badIdentity = snapshot(); badIdentity.patient_id = 'OTHER';
  const badPath = snapshot(); badPath.visits[0].image_path = 'https://external.invalid/photo';
  const badDay = snapshot(); badDay.brief.objective_measurements.visits[0].day = 7;
  for (const payload of [badIdentity, badPath, badDay]) {
    globalThis.fetch = async () => Response.json(payload);
    await assert.rejects(getWoundSession(sid, patient), /does not match|invalid/i);
  }
});

void test('server discovery rejects another patient even without browser session references', async () => {
  globalThis.fetch = async () => Response.json({ storage_provider: 'local_sqlite', sessions: [{ session_id: sid, patient_id: 'OTHER', created_at: '2026-09-01', visit_count: 1, storage_provider: 'local_sqlite', baseline_locked: true }] });
  await assert.rejects(listWoundSessions(patient), /does not match the patient/i);
});

void test('selected historical analysis cannot be replaced by another capture response', async () => {
  globalThis.fetch = async () => Response.json({ session_id: sid, patient_id: patient, visit_id: 'c'.repeat(32), brief: snapshot().brief });
  await assert.rejects(getWoundVisit(sid, vid, patient), /does not match the selected capture/i);
});

void test('retry analyzes stored bytes by ID and deletion requires explicit server acknowledgement', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, `/api/wound-sessions/${sid}/visits/${vid}/analyze?patient_id=${patient}`);
    assert.equal(init?.method, 'POST');
    assert.ok(init?.body instanceof FormData, 'retry sends only an optional inference result, never another capture');
    assert.equal((init!.body as FormData).has('image'), false);
    return Response.json(snapshot());
  };
  await retryWoundVisit(sid, vid, patient);
  globalThis.fetch = async () => Response.json({ deleted: true, session_id: 'c'.repeat(32) });
  await assert.rejects(deleteWoundSession(sid, patient), /could not be confirmed/i);
});

void test('validation errors preserve status but never echo submitted patient data', async () => {
  globalThis.fetch = async () => Response.json({ detail: [{ loc: ['body', 'day'], msg: 'Invalid time', input: 'PRIVATE-PROFILE' }] }, { status: 422 });
  await assert.rejects(getWoundSession(sid, patient), error => {
    assert.equal((error as Error).message, 'day: Invalid time');
    return true;
  });
});
