// Runs against the local dev server only. Restores the synthetic patient and
// encounter after checking writes; never accepts a hosted URL.
import assert from 'node:assert/strict';
const base = 'http://localhost:3000';
const signin = await fetch(`${base}/signin-with-chatgpt?return_to=/`, { redirect: 'manual' });
const cookie = signin.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie, 'Local sign-in must issue a session cookie');
async function request(path, body, status = 200, extra = {}) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { cookie, ...(body ? { 'Content-Type': 'application/json', Origin: base } : {}), ...extra }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const raw = await response.text();
  let data; try { data = JSON.parse(raw); } catch { data = { error: raw }; }
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
}
assert.equal((await fetch(base + '/api/portal')).status, 401);
const portal = await request('/api/portal');
assert.ok(portal.patients.length >= 5);
assert.equal(portal.storage.provider, 'd1');
const patient = portal.patients.find(p => p.id === 'patient-anh');
assert.ok(patient);
const originalVisits = (await request(`/api/portal/encounters?patient_id=${patient.id}`)).encounters;
assert.ok(originalVisits.length >= 2);
for (const p of portal.patients) {
  const visits = (await request(`/api/portal/encounters?patient_id=${p.id}`)).encounters;
  assert.ok(visits.every(e => e.patient_id === p.id));
}
let savedPatient, savedVisit;
try {
  savedPatient = (await request('/api/portal/patients', { ...patient, general_note: 'Verify UTF-8 persistence: baseline conditions, allergies, and follow-up.' })).patient;
  assert.equal(savedPatient.version, patient.version + 1);
  const reloaded = (await request('/api/portal')).patients.find(p => p.id === patient.id);
  assert.equal(reloaded.general_note, savedPatient.general_note);
  await request('/api/portal/patients', patient, 409);
  await request('/api/portal/patients', { ...patient, id: 'qa-duplicate-patient', version: 0 }, 409);
  await request('/api/portal/patients', savedPatient, 403, { Origin: 'https://external.invalid' });
  const encounter = originalVisits[0];
  savedVisit = (await request('/api/portal/encounters', { ...encounter, symptoms: 'Verification: mild cough and complete text persistence.' })).encounter;
  const after = (await request(`/api/portal/encounters?patient_id=${patient.id}`)).encounters.find(e => e.id === encounter.id);
  assert.equal(after.symptoms, savedVisit.symptoms);
  assert.deepEqual(after.medications, encounter.medications);
  assert.deepEqual(after.labs, encounter.labs);
  assert.deepEqual(after.clinician, encounter.clinician);
  await request('/api/portal/encounters', { ...savedVisit, patient_id: 'patient-tuan' }, 400);
  await request('/api/portal/encounters', encounter, 409);
  const snapshot = await request('/api/portal/data');
  assert.equal(snapshot.patients.length, portal.patients.length);
  assert.equal(snapshot.encounters.find(e => e.id === encounter.id).symptoms, savedVisit.symptoms);
  const sql = await fetch(base + '/api/portal/schema', { headers: { cookie } });
  assert.equal(sql.status, 200);
  assert.match(await sql.text(), /preserves edits and feedback/);
  for (const route of ['/editor', '/patient', '/data', '/feedback', `/visit/${encounter.id}?patient=${patient.id}`]) {
    assert.equal((await fetch(base + route, { headers: { cookie } })).status, 200, route);
  }
  console.log('PASS: 5 patient views, UTF-8 persistence, full encounter save/read, conflict prevention, patient ownership, CSRF, data explorer, SQL download and all portal routes.');
} finally {
  if (savedVisit) await request('/api/portal/encounters', { ...originalVisits[0], version: savedVisit.version });
  if (savedPatient) await request('/api/portal/patients', { ...patient, version: savedPatient.version });
}
