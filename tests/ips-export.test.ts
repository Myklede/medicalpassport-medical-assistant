import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import {
  buildIpsBundle,
  createIpsSnapshot,
  type FhirResource,
} from '../lib/ips.ts';
import { buildIpsPdf } from '../lib/ips-pdf.ts';
import { demoEncounters, demoPatients } from '../lib/portal-seed.ts';

function deterministicIds() {
  let id = 0;
  return () =>
    `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`;
}

function composition(bundle: ReturnType<typeof buildIpsBundle>) {
  return bundle.entry[0].resource as FhirResource & {
    status: string;
    section: Array<{
      code: { coding: Array<{ code: string; display: string }> };
      text: { div: string };
      entry?: Array<{ reference: string }>;
      emptyReason?: {
        coding: Array<{ system: string; code: string; display: string }>;
      };
    }>;
  };
}

void test('builds an IPS document bundle with the required sections and human narrative', () => {
  const patient = demoPatients().find((item) => item.id === 'patient-tuan')!;
  const snapshot = createIpsSnapshot(
    patient,
    demoEncounters(),
    'Supabase test source',
  );
  const bundle = buildIpsBundle(snapshot, {
    now: '2026-09-10T12:00:00.000Z',
    idFactory: deterministicIds(),
  });

  assert.equal(bundle.type, 'document');
  assert.equal(bundle.entry[0].resource.resourceType, 'Composition');
  assert.ok(
    bundle.entry.some((item) => item.resource.resourceType === 'Patient'),
  );
  assert.equal(composition(bundle).status, 'preliminary');
  assert.equal('attester' in composition(bundle), false);

  const required = new Map(
    composition(bundle).section.map((section) => [
      section.code.coding[0].code,
      section,
    ]),
  );
  for (const code of ['11450-4', '48765-2', '10160-0']) {
    assert.ok(required.has(code), `missing required section ${code}`);
    assert.match(
      required.get(code)!.text.div,
      /xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/,
    );
  }
  assert.ok(
    required.get('48765-2')!.emptyReason,
    'empty allergy section is explicit',
  );
  assert.equal(
    required.get('11450-4')!.code.coding[0].display,
    'Problem list - Reported',
  );
  assert.equal(
    required.get('48765-2')!.code.coding[0].display,
    'Allergies and adverse reactions Document',
  );
});

void test('uses only latest active medication status and conservative INN/ATC mappings', () => {
  const patients = demoPatients();
  const encounters = demoEncounters();
  const metforminSnapshot = createIpsSnapshot(
    patients.find((item) => item.id === 'patient-tuan')!,
    encounters,
    'test',
  );
  assert.equal(metforminSnapshot.medications.length, 1);
  assert.equal(metforminSnapshot.medications[0].inn, 'Metformin');
  assert.equal(metforminSnapshot.medications[0].atc, 'A10BA02');
  assert.equal(
    metforminSnapshot.results.find((item) => item.name === 'HbA1c')?.value,
    '7.1',
    'latest exact test result is selected',
  );
  assert.equal(
    metforminSnapshot.results.find((item) => item.name === 'HbA1c')
      ?.reference_high,
    5.6,
    'source reference range is preserved',
  );

  const ironSnapshot = createIpsSnapshot(
    patients.find((item) => item.id === 'patient-quynh')!,
    encounters,
    'test',
  );
  assert.equal(ironSnapshot.medications[0].name, 'Ferrous sulfate');
  assert.equal(ironSnapshot.medications[0].inn, null);
  assert.equal(ironSnapshot.medications[0].atc, null);

  const bundle = buildIpsBundle(ironSnapshot, {
    now: '2026-09-10T12:00:00.000Z',
    idFactory: deterministicIds(),
  });
  const medication = bundle.entry.find(
    (item) => item.resource.resourceType === 'Medication',
  )!.resource as FhirResource & { code: { text: string; coding?: unknown } };
  assert.equal(medication.code.text, 'Ferrous sulfate');
  assert.equal(
    medication.code.coding,
    undefined,
    'unknown ATC is never invented',
  );
});

void test('marks every empty mandatory IPS section with an empty reason', () => {
  const patient = {
    ...demoPatients()[0],
    id: 'empty-patient',
    conditions: [],
    allergies: [],
  };
  const bundle = buildIpsBundle(createIpsSnapshot(patient, [], 'test'), {
    now: '2026-09-10T12:00:00.000Z',
    idFactory: deterministicIds(),
  });
  const sections = composition(bundle).section;
  assert.deepEqual(
    sections.map((section) => section.code.coding[0].code),
    ['11450-4', '48765-2', '10160-0'],
  );
  assert.ok(sections.every((section) => section.emptyReason));
  assert.ok(sections.every((section) => !section.entry));
  assert.ok(
    sections.every(
      (section) => section.emptyReason?.coding[0].code === 'unavailable',
    ),
  );
  assert.ok(
    sections.every(
      (section) =>
        !section.text.div.includes('Nil Known') &&
        !section.text.div.includes('nilknown'),
    ),
    'an empty database array must not become a known-none clinical assertion',
  );
  assert.ok(
    sections.every((section) =>
      section.text.div.includes('does not assert that no items exist'),
    ),
  );
});

void test('uses Data Absent Reason instead of invalid empty patient primitives', () => {
  const patient = {
    ...demoPatients()[0],
    id: 'missing-demographics',
    display_name: '',
    medical_record_number: '',
    birth_date: '',
    conditions: [],
    allergies: [],
  };
  const bundle = buildIpsBundle(createIpsSnapshot(patient, [], 'test'), {
    now: '2026-09-10T12:00:00.000Z',
    idFactory: deterministicIds(),
  });
  const resource = bundle.entry.find(
    (item) => item.resource.resourceType === 'Patient',
  )!.resource as FhirResource & {
    identifier?: unknown;
    name: Array<{ text?: string; _text?: { extension: unknown[] } }>;
    birthDate?: string;
    _birthDate: { extension: unknown[] };
    text: { div: string };
  };

  assert.equal(resource.identifier, undefined);
  assert.equal(resource.name[0].text, undefined);
  assert.ok(resource.name[0]._text?.extension.length);
  assert.equal(resource.birthDate, undefined);
  assert.ok(resource._birthDate.extension.length);
  assert.match(resource.text.div, /Name: unavailable/);
});

void test('does not manufacture lab timing/status and preserves known UCUM units', () => {
  const patient = demoPatients().find((item) => item.id === 'patient-tuan')!;
  const bundle = buildIpsBundle(
    createIpsSnapshot(patient, demoEncounters(), 'test'),
    {
      now: '2026-09-10T12:00:00.000Z',
      idFactory: deterministicIds(),
    },
  );
  const lab = bundle.entry.find(
    (item) =>
      item.resource.resourceType === 'Observation' &&
      Array.isArray(item.resource.meta) === false &&
      JSON.stringify(item.resource.meta).includes(
        'Observation-results-laboratory-pathology-uv-ips',
      ),
  )!.resource as FhirResource & {
    status: string;
    effectiveDateTime?: string;
    _effectiveDateTime: { extension: unknown[] };
    performer: Array<{ display: string; extension: unknown[] }>;
    valueQuantity: { unit: string; system: string; code: string };
  };

  assert.equal(lab.status, 'unknown');
  assert.equal(lab.effectiveDateTime, undefined);
  assert.ok(lab._effectiveDateTime.extension.length);
  assert.equal(lab.performer[0].display, 'Unknown performer');
  assert.ok(lab.performer[0].extension.length);
  assert.equal(lab.valueQuantity.system, 'http://unitsofmeasure.org');
  assert.equal(lab.valueQuantity.code, '%');
});

void test('reconciles a newer stopped medication across dose changes', () => {
  const sourcePatient = demoPatients().find(
    (item) => item.id === 'patient-tuan',
  )!;
  const sourceEncounter = demoEncounters().find(
    (item) => item.patient_id === sourcePatient.id,
  )!;
  const patient = { ...sourcePatient, id: 'dose-change-patient' };
  const newer = {
    ...sourceEncounter,
    id: 'newer-stopped',
    patient_id: patient.id,
    visit_date: '2026-09-10',
    medications: [
      {
        ...sourceEncounter.medications[0],
        dose: '1000 mg',
        status: 'stopped',
      },
    ],
  };
  const older = {
    ...sourceEncounter,
    id: 'older-active',
    patient_id: patient.id,
    visit_date: '2026-08-10',
    medications: [
      {
        ...sourceEncounter.medications[0],
        dose: '500 mg',
        status: 'active',
      },
    ],
  };

  const snapshot = createIpsSnapshot(patient, [older, newer], 'test');
  assert.deepEqual(snapshot.medications, []);
  const medicationSection = composition(
    buildIpsBundle(snapshot, {
      now: '2026-09-10T12:00:00.000Z',
      idFactory: deterministicIds(),
    }),
  ).section.find((item) => item.code.coding[0].code === '10160-0')!;
  assert.equal(
    medicationSection.emptyReason?.coding[0].code,
    'unavailable',
  );
});

void test('omits a fabricated allergy reaction and keeps date precision', () => {
  const patient = {
    ...demoPatients()[0],
    allergies: [
      {
        ...demoPatients()[0].allergies[0],
        reaction: '',
      },
    ],
  };
  const bundle = buildIpsBundle(
    createIpsSnapshot(patient, demoEncounters(), 'test'),
    {
      now: '2026-09-10T12:00:00.000Z',
      idFactory: deterministicIds(),
    },
  );
  const allergy = bundle.entry.find(
    (item) => item.resource.resourceType === 'AllergyIntolerance',
  )!.resource as FhirResource & { reaction?: unknown };
  assert.equal(allergy.reaction, undefined);

  const procedure = bundle.entry.find(
    (item) => item.resource.resourceType === 'Procedure',
  )!.resource as FhirResource & {
    status: string;
    performedDateTime: string;
  };
  assert.equal(procedure.status, 'unknown');
  assert.match(procedure.performedDateTime, /^\d{4}-\d{2}-\d{2}$/);
});

void test('selects the latest valid value independently for each vital sign', () => {
  const patient = demoPatients()[0];
  const base = demoEncounters().find(
    (item) => item.patient_id === patient.id,
  )!;
  const newer = {
    ...base,
    id: 'newer-partial-vitals',
    visit_date: '2026-09-10',
    blood_pressure: 'not-a-blood-pressure',
    pulse: '81',
    temperature: '',
    weight: '',
    oxygen_saturation: '',
  };
  const older = {
    ...base,
    id: 'older-vitals',
    visit_date: '2026-08-10',
    blood_pressure: '120/80',
    pulse: '70',
  };
  const snapshot = createIpsSnapshot(patient, [older, newer], 'test');

  assert.equal(
    snapshot.vitals.find((item) => item.key === 'pulse')?.recordedDate,
    '2026-09-10',
  );
  assert.equal(
    snapshot.vitals.find((item) => item.key === 'blood-pressure')?.recordedDate,
    '2026-08-10',
  );
  assert.equal(
    snapshot.vitals.some((item) => item.value === 'not-a-blood-pressure'),
    false,
  );
});

void test('generates a readable multipage PDF containing the FHIR JSON attachment', async () => {
  const patient = demoPatients().find((item) => item.id === 'patient-tuan')!;
  const snapshot = createIpsSnapshot(
    patient,
    demoEncounters(),
    'Supabase test source',
  );
  const bundle = buildIpsBundle(snapshot, {
    now: '2026-09-10T12:00:00.000Z',
    idFactory: deterministicIds(),
  });
  const regular = readFileSync(
    resolve('node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf'),
  );
  const bold = readFileSync(
    resolve('node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf'),
  );
  const bytes = await buildIpsPdf(snapshot, bundle, regular, bold);
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), '%PDF-');
  assert.ok(Buffer.from(bytes).includes(Buffer.from('/EmbeddedFiles')));
  assert.ok(Buffer.from(bytes).includes(Buffer.from('medipass-ips.fhir.json')));
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 2);
});
