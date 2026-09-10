import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretLab, currentMedicines, referenceLabel, glossaryForLab } from '../lib/lab-interpretation.ts';
import { educationForCondition } from '../lib/patient-education.ts';
import { validatePatient, validateEncounter, validateFeedback } from '../lib/portal-validation.ts';
import { demoEncounters, demoPatients } from '../lib/portal-seed.ts';
import type { Lab } from '../lib/portal-types.ts';

const lab: Lab = { id: 'lab-1', name: 'Glucose', plain_name: '', value: '99', unit: 'mg/dL', reference_low: 70, reference_high: 99, reference_text: '', explanation: '', clinician_note: '', source_url: '' };
void test('uses the lab-supplied range with inclusive boundaries', () => {
  assert.equal(interpretLab(lab).status, 'within');
  assert.equal(interpretLab({ ...lab, value: '70' }).status, 'within');
  assert.equal(interpretLab({ ...lab, value: '100' }).status, 'high');
  assert.equal(interpretLab({ ...lab, value: '69,5' }).status, 'low');
});
void test('does not invent interpretation for missing or qualitative reference data', () => {
  for (const value of ['', 'negative', '<70', '>99', '99 mg/dL']) assert.equal(interpretLab({ ...lab, value }).status, 'unknown');
  assert.equal(interpretLab({ ...lab, reference_low: null, reference_high: null }).status, 'unknown');
  assert.equal(interpretLab({ ...lab, reference_low: 100, reference_high: 70 }).status, 'unknown');
  assert.equal(interpretLab({ ...lab, unit: '' }).status, 'unknown');
  assert.equal(interpretLab({ ...lab, reference_low: NaN }).status, 'unknown');
});
void test('one-sided ranges and glossary preserve the original measurement meaning', () => {
  assert.equal(referenceLabel({ ...lab, reference_low: null }), '≤ 99 mg/dL');
  assert.equal(referenceLabel({ ...lab, reference_high: null }), '≥ 70 mg/dL');
  assert.equal(glossaryForLab('  Hemoglobin (Hb)  ')?.plain_name, 'Chất giúp máu mang oxy');
  assert.equal(glossaryForLab('Glucose tolerance test'), undefined);
});
void test('patient explanations cover known conditions without guessing unknown diagnoses', () => {
  const asthma = educationForCondition('Hen phế quản', 'Asthma');
  assert.ok(asthma);
  assert.match(asthma.simple, /đường thở/i);
  assert.match(asthma.impact, /nguy hiểm/i);
  assert.match(asthma.habits, /khói thuốc/i);
  assert.ok(asthma.sources.every(source => source.url.startsWith('https://')));
  for (const patient of demoPatients()) {
    for (const condition of patient.conditions) assert.ok(educationForCondition(condition.name, condition.clinical_term), condition.name);
  }
  assert.equal(educationForCondition('Tên bệnh chưa được kiểm duyệt'), undefined);
});
void test('lab glossary includes plain impact and daily habit guidance', () => {
  const hba1c = glossaryForLab('HbA1c');
  assert.ok(hba1c);
  assert.match(hba1c.impact, /tim, thận, mắt/i);
  assert.match(hba1c.habits, /hạn chế nước ngọt/i);
});
void test('later discontinuation replaces earlier active medicine without duplicate cards', () => {
  const visits = demoEncounters().filter(e => e.patient_id === 'patient-linh');
  assert.equal(currentMedicines(visits).length, 0);
  const diabetes = demoEncounters().filter(e => e.patient_id === 'patient-tuan');
  assert.equal(currentMedicines(diabetes).length, 1);
});
void test('patient validation rejects duplicate shared histories and invalid birth dates', () => {
  const patient = demoPatients()[0];
  assert.equal(validatePatient(patient).display_name, patient.display_name);
  assert.throws(() => validatePatient({ ...patient, birth_date: '2026-02-31' }));
  assert.throws(() => validatePatient({ ...patient, birth_date: '2099-01-01' }));
  assert.throws(() => validatePatient({ ...patient, conditions: [...patient.conditions, { ...patient.conditions[0], id: 'another' }] }));
});
void test('all seeded encounters can be edited after API validation', () => {
  for (const visit of demoEncounters()) {
    const normalized = { ...visit, labs: visit.labs.map((l,i) => ({ ...l, id: `lab-${i}` })), medications: visit.medications.map((m,i) => ({ ...m, id: `med-${i}` })) };
    assert.equal(validateEncounter(normalized).patient_id, visit.patient_id);
  }
});
void test('lab validation rejects reversed ranges and unsafe links', () => {
  const encounter = { ...demoEncounters()[0], labs: [lab], medications: [] };
  assert.throws(() => validateEncounter({ ...encounter, labs: [{ ...lab, reference_low: 110 }] }));
  assert.throws(() => validateEncounter({ ...encounter, labs: [{ ...lab, unit: '' }] }));
  assert.throws(() => validateEncounter({ ...encounter, labs: [{ ...lab, source_url: 'javascript:alert(1)' }] }));
  assert.throws(() => validateEncounter({ ...encounter, labs: [lab, { ...lab, name: 'Different test' }] }));
});
void test('feedback validation allows page context but rejects external redirects and empty requests', () => {
  const feedback = { id: 'test', version: 0, title: 'Thu gọn', description: 'Thu gọn thẻ khám', page_path: '/patient?patient=patient-anh' };
  assert.equal(validateFeedback(feedback).status, 'open');
  assert.throws(() => validateFeedback({ ...feedback, page_path: '//malicious.test' }));
  assert.throws(() => validateFeedback({ ...feedback, page_path: '/\\malicious.test' }));
  assert.throws(() => validateFeedback({ ...feedback, description: '' }));
});
void test('visual comments preserve element, quote and relative position, and reject invalid coordinates', () => {
  const annotation = { selector: '[data-annotate="general-note"]', quote: 'Ghi chú chung', x: 0.3, y: 0.6, viewport_width: 390, viewport_height: 844 };
  const comment = { id: 'pin-test', version: 0, title: 'Ghi chú', description: 'Thu gọn thẻ', page_path: '/patient', annotation };
  assert.deepEqual(validateFeedback(comment).annotation, annotation);
  for (const x of [-1, 1.1, Infinity, '0.5']) assert.throws(() => validateFeedback({ ...comment, annotation: { ...annotation, x } }));
});
