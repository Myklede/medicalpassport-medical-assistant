// PostgreSQL contract checks in an isolated, in-memory PGlite database.
// Run with Node 22 + @electric-sql/pglite supplied by npm exec.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { demoPatients, demoEncounters, demoClinicians } from '../lib/portal-seed.ts';
const modulePath = process.env.PATH.split(delimiter).map(p => join(dirname(p), '@electric-sql/pglite/dist/index.js')).find(existsSync);
assert.ok(modulePath, 'Supply @electric-sql/pglite with npm exec');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
for (const file of ['20260905000000_medipass_core.sql', '20260909000000_medipass_portal.sql', '20260909010000_preserve_portal_demo.sql', '20260909020000_visual_annotations.sql']) {
  await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
}
async function rpc(name, args) {
  const result = await db.query(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) as result`, args.map(a => typeof a === 'object' ? JSON.stringify(a) : a));
  return result.rows[0].result;
}
const seed = {
  patients: demoPatients(), clinicians: demoClinicians,
  encounters: demoEncounters().map(e => ({ ...e, labs: e.labs.map((l, i) => ({ ...l, id: `lab-${i}` })), medications: e.medications.map((m, i) => ({ ...m, id: `med-${i}` })) })),
  feedback: [{ id: 'feedback-demo', version: 4, title: 'Góp ý đã lưu', description: 'Giữ góp ý khi nối Supabase', category: 'interface', priority: 'normal', status: 'open', page_path: '/patient', section: 'Hồ sơ', patient_id: '', encounter_id: '', resolution: '', created_at: '', updated_at: '' }],
};
seed.patients[0].general_note = 'Ghi chú đã chỉnh trước khi kết nối';
try {
  const initial = await rpc('mp_portal_bootstrap', ['workspace-a', seed]);
  assert.equal(initial.patients.length, 5);
  assert.equal(initial.encounters.length, 10);
  assert.equal(initial.feedback[0].title, seed.feedback[0].title);
  assert.equal(initial.patients[0].general_note, seed.patients[0].general_note);
  const patient = initial.patients[0];
  const updated = await rpc('mp_portal_save', ['workspace-a', 'patient', { ...patient, general_note: 'Lưu vào PostgreSQL' }, patient.version]);
  assert.equal(updated.version, 2);
  await assert.rejects(rpc('mp_portal_save', ['workspace-a', 'patient', patient, patient.version]), /VERSION_CONFLICT/);
  const repeat = await rpc('mp_portal_bootstrap', ['workspace-a', seed]);
  assert.equal(repeat.patients[0].general_note, 'Lưu vào PostgreSQL');
  assert.equal(repeat.feedback.length, 1);
  const pin = { selector: '[data-annotate="general-note"]', quote: 'Ghi chú chung', x: 0.25, y: 0.5, viewport_width: 390, viewport_height: 844 };
  const note = repeat.feedback[0];
  const pinned = await rpc('mp_portal_save', ['workspace-a', 'feedback', { ...note, annotation: pin }, note.version]);
  const checkedPin = (await rpc('mp_portal_read', ['workspace-a'])).feedback[0];
  assert.deepEqual(checkedPin.annotation, pin);
  await rpc('mp_portal_save', ['workspace-a', 'feedback', { ...pinned, annotation: { ...pin, x: 0.75 } }, pinned.version]);
  assert.equal((await rpc('mp_portal_read', ['workspace-a'])).feedback[0].annotation.x, 0.75);
  assert.deepEqual((await rpc('mp_portal_read', ['workspace-b'])).patients, []);
  const newcomer = { ...patient, id: 'new-patient', medical_record_number: 'MP-0006', display_name: 'Bệnh nhân thêm mới' };
  await rpc('mp_portal_save', ['workspace-a', 'patient', newcomer, 0]);
  assert.equal((await rpc('mp_portal_read', ['workspace-a'])).patients.length, 6);
  const visit = repeat.encounters[0];
  const changed = await rpc('mp_portal_save', ['workspace-a', 'encounter', { ...visit, symptoms: 'Triệu chứng cập nhật', labs: [] }, visit.version]);
  assert.equal(changed.version, 2);
  const after = (await rpc('mp_portal_read', ['workspace-a'])).encounters.find(e => e.id === visit.id);
  assert.equal(after.symptoms, 'Triệu chứng cập nhật');
  assert.deepEqual(after.medications, visit.medications);
  await assert.rejects(rpc('mp_portal_save', ['workspace-a', 'encounter', { ...changed, patient_id: 'new-patient' }, changed.version]), /PATIENT_CHANGE_NOT_ALLOWED/);
  const bad = { ...changed, symptoms: 'Must roll back', labs: [{ id: 'same', name: 'Test', value: '1' }, { id: 'same', name: 'Test', value: '2' }] };
  await assert.rejects(rpc('mp_portal_save', ['workspace-a', 'encounter', bad, changed.version]));
  assert.equal((await rpc('mp_portal_read', ['workspace-a'])).encounters.find(e => e.id === visit.id).symptoms, 'Triệu chứng cập nhật');
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from mp_portal_patients'), /permission denied/);
  await assert.rejects(rpc('mp_portal_read', ['workspace-a']), /permission denied/);
  await db.exec('reset role; set role service_role');
  assert.equal((await rpc('mp_portal_read', ['workspace-a'])).patients.length, 6);
  console.log('PASS: PostgreSQL migrations, 5 patients/10 encounters, new patient, editing, atomic rollback, version conflicts, workspace isolation, demo/feedback transfer, idempotent bootstrap and role restrictions.');
} finally { await db.close(); }
