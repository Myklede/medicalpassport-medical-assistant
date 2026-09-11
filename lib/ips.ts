import { MEDICATION_EXCHANGES } from './medication-exchange.ts';
import type {
  Allergy,
  Condition,
  Encounter,
  Lab,
  Medicine,
  Patient,
  Procedure,
} from './portal-types.ts';

export const IPS_VERSION = '2.0.1';
export const IPS_BUNDLE_PROFILE =
  'http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips|2.0.1';

const DATA_ABSENT_REASON_URL =
  'http://hl7.org/fhir/StructureDefinition/data-absent-reason';
const LIST_EMPTY_REASON_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/list-empty-reason';
const SECTION_LOINC_DISPLAYS: Record<string, string> = {
  '11450-4': 'Problem list - Reported',
  '48765-2': 'Allergies and adverse reactions Document',
  '10160-0': 'History of Medication use Narrative',
  '30954-2': 'Relevant diagnostic tests/laboratory data note',
  '47519-4': 'History of Procedures Document',
  '8716-3': 'Vital signs note',
  '18776-5': 'Plan of care note',
};

export type IpsMedication = Medicine & {
  encounterId: string;
  recordedDate: string;
  inn: string | null;
  atc: string | null;
  mappingStatus: 'verified-catalog-match' | 'unmapped';
};

export type IpsLab = Lab & { encounterId: string; recordedDate: string };
export type IpsProcedure = Procedure & {
  encounterId: string;
  performedDate: string;
};
export type IpsVital = {
  key:
    | 'blood-pressure'
    | 'pulse'
    | 'temperature'
    | 'weight'
    | 'oxygen-saturation';
  label: string;
  value: string;
  unit: string;
  recordedDate: string;
  encounterId: string;
};

export type IpsSnapshot = {
  patient: Patient;
  conditions: Condition[];
  allergies: Allergy[];
  medications: IpsMedication[];
  results: IpsLab[];
  procedures: IpsProcedure[];
  vitals: IpsVital[];
  plan: null | {
    treatmentPlan: string;
    followUp: string;
    followUpDate: string;
    recordedDate: string;
    encounterId: string;
  };
  latestEncounterDate: string | null;
  sourceLabel: string;
};

export type FhirResource = Record<string, unknown> & {
  resourceType: string;
  id?: string;
};

export type FhirBundle = FhirResource & {
  resourceType: 'Bundle';
  type: 'document';
  identifier: { system: string; value: string };
  timestamp: string;
  entry: Array<{ fullUrl: string; resource: FhirResource }>;
};

const exactMedicationAliases: Record<string, string> = {
  albuterol: 'salbutamol',
  'albuterol inhaler': 'salbutamol',
  amlodipine: 'amlodipine',
  metformin: 'metformin',
  omeprazole: 'omeprazole',
  salbutamol: 'salbutamol',
  'salbutamol inhaler': 'salbutamol',
};

function normalized(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('en')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim();
}

function sortedEncounters(
  encounters: Encounter[],
  patientId: string,
): Encounter[] {
  return encounters
    .filter((encounter) => encounter.patient_id === patientId)
    .sort(
      (a, b) =>
        b.visit_date.localeCompare(a.visit_date) ||
        b.created_at.localeCompare(a.created_at),
    );
}

export function mapMedicationToInternationalCodes(name: string): {
  inn: string | null;
  atc: string | null;
  mappingStatus: IpsMedication['mappingStatus'];
} {
  const catalogId = exactMedicationAliases[normalized(name)];
  const catalogEntry = catalogId
    ? MEDICATION_EXCHANGES.find((entry) => entry.id === catalogId)
    : undefined;
  if (!catalogEntry) {
    return { inn: null, atc: null, mappingStatus: 'unmapped' };
  }
  return {
    inn: catalogEntry.inn,
    atc: catalogEntry.atc,
    mappingStatus: 'verified-catalog-match',
  };
}

function activeMedications(encounters: Encounter[]): IpsMedication[] {
  const seen = new Set<string>();
  const medicines: IpsMedication[] = [];
  for (const encounter of encounters) {
    for (const medication of encounter.medications) {
      const mapping = mapMedicationToInternationalCodes(medication.name);
      const medicationIdentity = mapping.atc
        ? `atc:${mapping.atc}`
        : `name:${normalized(medication.name)}`;
      const key = `${medicationIdentity}|route:${normalized(medication.route)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (medication.status !== 'active') continue;
      medicines.push({
        ...medication,
        ...mapping,
        encounterId: encounter.id,
        recordedDate: encounter.visit_date,
      });
    }
  }
  return medicines;
}

function latestResults(encounters: Encounter[]): IpsLab[] {
  const seen = new Set<string>();
  const results: IpsLab[] = [];
  for (const encounter of encounters) {
    for (const lab of encounter.labs) {
      const key = normalized(lab.name);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        ...lab,
        encounterId: encounter.id,
        recordedDate: encounter.visit_date,
      });
    }
  }
  return results;
}

function relevantProcedures(encounters: Encounter[]): IpsProcedure[] {
  const seen = new Set<string>();
  const procedures: IpsProcedure[] = [];
  for (const encounter of encounters) {
    for (const procedure of encounter.procedures) {
      const key = normalized(procedure.name);
      if (seen.has(key)) continue;
      seen.add(key);
      procedures.push({
        ...procedure,
        encounterId: encounter.id,
        performedDate: encounter.visit_date,
      });
    }
  }
  return procedures;
}

function latestVitals(encounters: Encounter[]): IpsVital[] {
  const definitions: Array<{
    key: IpsVital['key'];
    label: string;
    unit: string;
    read: (encounter: Encounter) => string;
    valid: (value: string) => boolean;
  }> = [
    {
      key: 'blood-pressure',
      label: 'Blood pressure / Huyết áp',
      unit: 'mmHg',
      read: (encounter) => encounter.blood_pressure,
      valid: (value) =>
        /^\s*\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*$/.test(value),
    },
    {
      key: 'pulse',
      label: 'Heart rate / Nhịp tim',
      unit: '/min',
      read: (encounter) => encounter.pulse,
      valid: (value) => numeric(value) !== null,
    },
    {
      key: 'temperature',
      label: 'Body temperature / Nhiệt độ',
      unit: '°C',
      read: (encounter) => encounter.temperature,
      valid: (value) => numeric(value) !== null,
    },
    {
      key: 'weight',
      label: 'Body weight / Cân nặng',
      unit: 'kg',
      read: (encounter) => encounter.weight,
      valid: (value) => numeric(value) !== null,
    },
    {
      key: 'oxygen-saturation',
      label: 'Oxygen saturation / SpO₂',
      unit: '%',
      read: (encounter) => encounter.oxygen_saturation,
      valid: (value) => numeric(value) !== null,
    },
  ];
  const vitals: IpsVital[] = [];
  for (const definition of definitions) {
    for (const encounter of encounters) {
      const value = definition.read(encounter).trim();
      if (!value || !definition.valid(value)) continue;
      vitals.push({
        key: definition.key,
        label: definition.label,
        value,
        unit: definition.unit,
        encounterId: encounter.id,
        recordedDate: encounter.visit_date,
      });
      break;
    }
  }
  return vitals;
}

export function createIpsSnapshot(
  patient: Patient,
  encounters: Encounter[],
  sourceLabel: string,
): IpsSnapshot {
  const sorted = sortedEncounters(encounters, patient.id);
  const planEncounter = sorted.find(
    (encounter) =>
      encounter.treatment_plan.trim() ||
      encounter.follow_up.trim() ||
      encounter.follow_up_date.trim(),
  );
  return {
    patient,
    conditions: patient.conditions,
    allergies: patient.allergies,
    medications: activeMedications(sorted),
    results: latestResults(sorted),
    procedures: relevantProcedures(sorted),
    vitals: latestVitals(sorted),
    plan: planEncounter
      ? {
          treatmentPlan: planEncounter.treatment_plan,
          followUp: planEncounter.follow_up,
          followUpDate: planEncounter.follow_up_date,
          recordedDate: planEncounter.visit_date,
          encounterId: planEncounter.id,
        }
      : null,
    latestEncounterDate: sorted[0]?.visit_date ?? null,
    sourceLabel,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function narrative(
  title: string,
  lines: string[],
): { status: 'generated'; div: string } {
  const items = lines.length
    ? `<ul>${lines.map((line) => `<li>${escapeXml(line)}</li>`).join('')}</ul>`
    : '<p>No information is available in the source record. This does not assert that no items exist.</p>';
  return {
    status: 'generated',
    div: `<div xmlns="http://www.w3.org/1999/xhtml"><p><b>${escapeXml(title)}</b></p>${items}</div>`,
  };
}

function section(
  title: string,
  code: string,
  lines: string[],
  references: string[],
  required = false,
): Record<string, unknown> | null {
  if (!required && references.length === 0) return null;
  return {
    title,
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code,
          display: SECTION_LOINC_DISPLAYS[code],
        },
      ],
    },
    text: narrative(title, lines),
    ...(references.length
      ? { entry: references.map((reference) => ({ reference })) }
      : {
          emptyReason: {
            coding: [
              {
                system: LIST_EMPTY_REASON_SYSTEM,
                code: 'unavailable',
                display: 'Unavailable',
              },
            ],
          },
        }),
  };
}

function fhirId(idFactory: () => string): string {
  return (
    idFactory()
      .replace(/[^A-Za-z0-9.-]/g, '-')
      .slice(0, 64) || 'generated'
  );
}

function ref(id: string): string {
  return `urn:uuid:${id}`;
}

function entry(resource: FhirResource): {
  fullUrl: string;
  resource: FhirResource;
} {
  return { fullUrl: ref(resource.id as string), resource };
}

function sexCode(sex: string): string {
  return ['female', 'male', 'other', 'unknown'].includes(sex)
    ? sex
    : sex === 'unspecified'
      ? 'unknown'
      : 'unknown';
}

function severityCode(severity: string): string | undefined {
  return ['mild', 'moderate', 'severe'].includes(severity)
    ? severity
    : undefined;
}

function numeric(value: string): number | null {
  const normalizedValue = value.trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(normalizedValue)) return null;
  const result = Number(normalizedValue);
  return Number.isFinite(result) ? result : null;
}

function dataAbsentReason(
  valueCode:
    | 'unknown'
    | 'not-asked'
    | 'masked'
    | 'not-permitted' = 'unknown',
): { extension: Array<{ url: string; valueCode: string }> } {
  return {
    extension: [{ url: DATA_ABSENT_REASON_URL, valueCode }],
  };
}

function unknownPerformer(): Record<string, unknown> {
  return {
    display: 'Unknown performer',
    ...dataAbsentReason('unknown'),
  };
}

function validFhirDate(value: string): string | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value.trim()
    : null;
}

const UCUM_CODES: Record<string, string> = {
  '%': '%',
  'g/dL': 'g/dL',
  'mg/dL': 'mg/dL',
  'ng/mL': 'ng/mL',
};

function labQuantity(value: number, unit: string): Record<string, unknown> {
  const trimmedUnit = unit.trim();
  const ucum = UCUM_CODES[trimmedUnit];
  return {
    value,
    ...(trimmedUnit ? { unit: trimmedUnit } : {}),
    ...(ucum
      ? {
          system: 'http://unitsofmeasure.org',
          code: ucum,
        }
      : {}),
  };
}

function labReferenceRange(
  lab: IpsLab,
): Array<Record<string, unknown>> | undefined {
  if (
    lab.reference_low === null &&
    lab.reference_high === null &&
    !lab.reference_text
  ) {
    return undefined;
  }
  return [
    {
      ...(lab.reference_low !== null
        ? { low: labQuantity(lab.reference_low, lab.unit) }
        : {}),
      ...(lab.reference_high !== null
        ? { high: labQuantity(lab.reference_high, lab.unit) }
        : {}),
      ...(lab.reference_text ? { text: lab.reference_text } : {}),
    },
  ];
}

export function buildIpsBundle(
  snapshot: IpsSnapshot,
  options: { now?: Date | string; idFactory?: () => string } = {},
): FhirBundle {
  const timestamp =
    typeof options.now === 'string'
      ? new Date(options.now).toISOString()
      : (options.now ?? new Date()).toISOString();
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const bundleId = fhirId(idFactory);
  const compositionId = fhirId(idFactory);
  const patientId = fhirId(idFactory);
  const organizationId = fhirId(idFactory);
  const patientReference = ref(patientId);
  const organizationReference = ref(organizationId);
  const patientName = snapshot.patient.display_name.trim();
  const medicalRecordNumber = snapshot.patient.medical_record_number.trim();
  const birthDate = validFhirDate(snapshot.patient.birth_date);

  const patient: FhirResource = {
    resourceType: 'Patient',
    id: patientId,
    meta: {
      profile: [
        'http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips',
      ],
    },
    ...(medicalRecordNumber
      ? {
          identifier: [
            {
              system: 'https://medipass.local/medical-record-number',
              value: medicalRecordNumber,
            },
          ],
        }
      : {}),
    name: patientName
      ? [{ text: patientName }]
      : [{ _text: dataAbsentReason('unknown') }],
    gender: sexCode(snapshot.patient.sex),
    ...(birthDate
      ? { birthDate }
      : { _birthDate: dataAbsentReason('unknown') }),
    ...(snapshot.patient.phone.trim() || snapshot.patient.email.trim()
      ? {
          telecom: [
            ...(snapshot.patient.phone.trim()
              ? [{ system: 'phone', value: snapshot.patient.phone.trim() }]
              : []),
            ...(snapshot.patient.email.trim()
              ? [{ system: 'email', value: snapshot.patient.email.trim() }]
              : []),
          ],
        }
      : {}),
    ...(snapshot.patient.address.trim()
      ? { address: [{ text: snapshot.patient.address.trim() }] }
      : {}),
    text: narrative('Patient', [
      `Name: ${patientName || 'unavailable'}`,
      `Medical record number: ${medicalRecordNumber || 'unavailable'}`,
      `Date of birth: ${birthDate || 'unavailable'}`,
    ]),
  };

  const organization: FhirResource = {
    resourceType: 'Organization',
    id: organizationId,
    name: 'MediPass Demo',
    text: narrative('Document generator', [snapshot.sourceLabel]),
  };

  const conditionEntries = snapshot.conditions.map((condition) => {
    const id = fhirId(idFactory);
    const conditionCode = (condition.clinical_term || condition.name).trim();
    const resource: FhirResource = {
      resourceType: 'Condition',
      id,
      meta: {
        profile: [
          'http://hl7.org/fhir/uv/ips/StructureDefinition/Condition-uv-ips',
        ],
      },
      clinicalStatus: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
            code: condition.status === 'resolved' ? 'resolved' : 'active',
          },
        ],
      },
      code: conditionCode
        ? { text: conditionCode }
        : dataAbsentReason('unknown'),
      subject: { reference: patientReference },
      ...(condition.since ? { onsetString: condition.since } : {}),
      ...(condition.note ? { note: [{ text: condition.note }] } : {}),
      text: narrative(
        'Problem',
        [condition.name, condition.clinical_term, condition.note].filter(
          Boolean,
        ),
      ),
    };
    return entry(resource);
  });

  const allergyEntries = snapshot.allergies.map((allergy) => {
    const id = fhirId(idFactory);
    const severity = severityCode(allergy.severity);
    const substance = allergy.substance.trim();
    const reaction = allergy.reaction.trim();
    const resource: FhirResource = {
      resourceType: 'AllergyIntolerance',
      id,
      meta: {
        profile: [
          'http://hl7.org/fhir/uv/ips/StructureDefinition/AllergyIntolerance-uv-ips',
        ],
      },
      clinicalStatus: {
        coding: [
          {
            system:
              'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
            code: 'active',
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system:
              'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
            code: 'unconfirmed',
          },
        ],
      },
      code: substance ? { text: substance } : dataAbsentReason('unknown'),
      patient: { reference: patientReference },
      ...(allergy.note.trim() ? { note: [{ text: allergy.note.trim() }] } : {}),
      ...(reaction
        ? {
            reaction: [
              {
                manifestation: [{ text: reaction }],
                ...(severity ? { severity } : {}),
                ...(allergy.note.trim()
                  ? { description: allergy.note.trim() }
                  : {}),
              },
            ],
          }
        : {}),
      text: narrative(
        'Allergy or intolerance',
        [allergy.substance, allergy.reaction, allergy.note].filter(Boolean),
      ),
    };
    return entry(resource);
  });

  const medicationEntries: Array<{ fullUrl: string; resource: FhirResource }> =
    [];
  const medicationStatementReferences: string[] = [];
  const medicationLines: string[] = [];
  for (const medication of snapshot.medications) {
    const medicationId = fhirId(idFactory);
    const statementId = fhirId(idFactory);
    const medicationReference = ref(medicationId);
    const medicationName = medication.name.trim();
    const codeText = medication.inn
      ? `${medication.name} — INN: ${medication.inn}`
      : medicationName;
    const medicationResource: FhirResource = {
      resourceType: 'Medication',
      id: medicationId,
      meta: {
        profile: [
          'http://hl7.org/fhir/uv/ips/StructureDefinition/Medication-uv-ips',
        ],
      },
      code: {
        ...(medication.atc
          ? {
              coding: [
                {
                  system: 'http://www.whocc.no/atc',
                  code: medication.atc,
                },
              ],
            }
          : {}),
        ...(codeText ? { text: codeText } : dataAbsentReason('unknown')),
      },
      ...(medication.inn
        ? {
            ingredient: [
              {
                itemCodeableConcept: { text: medication.inn },
                isActive: true,
              },
            ],
          }
        : {}),
      text: narrative('Medication', [codeText].filter(Boolean)),
    };
    const dosageText = [
      medication.dose,
      medication.route,
      medication.frequency,
      medication.duration,
      medication.instructions,
    ]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' · ');
    const assertedDate = validFhirDate(medication.recordedDate);
    const statementResource: FhirResource = {
      resourceType: 'MedicationStatement',
      id: statementId,
      meta: {
        profile: [
          'http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationStatement-uv-ips',
        ],
      },
      status: 'active',
      medicationReference: {
        reference: medicationReference,
        ...(medicationName ? { display: medicationName } : {}),
      },
      subject: { reference: patientReference },
      _effectiveDateTime: dataAbsentReason('unknown'),
      ...(assertedDate ? { dateAsserted: assertedDate } : {}),
      ...(dosageText
        ? {
            dosage: [
              {
                text: dosageText,
                ...(medication.route.trim()
                  ? { route: { text: medication.route.trim() } }
                  : {}),
              },
            ],
          }
        : {}),
      text: narrative(
        'Medication statement',
        [
          codeText,
          [medication.dose, medication.route, medication.frequency]
            .filter(Boolean)
            .join(' · '),
        ].filter(Boolean),
      ),
    };
    medicationEntries.push(entry(statementResource), entry(medicationResource));
    medicationStatementReferences.push(ref(statementId));
    medicationLines.push(
      `${medicationName || 'Medication name unavailable'}${medication.inn ? ` · INN ${medication.inn}` : ' · international code not mapped'}${medication.atc ? ` · ATC ${medication.atc}` : ''}`,
    );
  }

  const resultEntries = snapshot.results.map((lab) => {
    const id = fhirId(idFactory);
    const numericValue = numeric(lab.value);
    const referenceRange = labReferenceRange(lab);
    const labName = lab.name.trim();
    const labValue = lab.value.trim();
    const resource: FhirResource = {
      resourceType: 'Observation',
      id,
      meta: {
        profile: [
          'http://hl7.org/fhir/uv/ips/StructureDefinition/Observation-results-laboratory-pathology-uv-ips',
        ],
      },
      status: 'unknown',
      category: [
        {
          coding: [
            {
              system:
                'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
            },
          ],
        },
      ],
      code: labName ? { text: labName } : dataAbsentReason('unknown'),
      subject: { reference: patientReference },
      _effectiveDateTime: dataAbsentReason('unknown'),
      performer: [unknownPerformer()],
      ...(labValue && numericValue !== null
        ? {
            valueQuantity: labQuantity(numericValue, lab.unit),
          }
        : labValue
          ? { valueString: labValue }
          : {
              dataAbsentReason: {
                coding: [
                  {
                    system:
                      'http://terminology.hl7.org/CodeSystem/data-absent-reason',
                    code: 'unknown',
                  },
                ],
              },
            }),
      ...(referenceRange ? { referenceRange } : {}),
      ...(lab.clinician_note ? { note: [{ text: lab.clinician_note }] } : {}),
      text: narrative(
        'Diagnostic result',
        [
          `${lab.name}: ${lab.value} ${lab.unit}`.trim(),
          lab.reference_text,
          lab.clinician_note,
        ].filter(Boolean),
      ),
    };
    return entry(resource);
  });

  const procedureEntries = snapshot.procedures.map((procedure) => {
    const id = fhirId(idFactory);
    const procedureName = procedure.name.trim();
    const performedDate = validFhirDate(procedure.performedDate);
    const resource: FhirResource = {
      resourceType: 'Procedure',
      id,
      meta: {
        profile: [
          'http://hl7.org/fhir/uv/ips/StructureDefinition/Procedure-uv-ips',
        ],
      },
      status: 'unknown',
      code: procedureName
        ? { text: procedureName }
        : dataAbsentReason('unknown'),
      subject: { reference: patientReference },
      ...(performedDate
        ? { performedDateTime: performedDate }
        : { _performedDateTime: dataAbsentReason('unknown') }),
      ...(procedure.result ? { outcome: { text: procedure.result } } : {}),
      ...(procedure.explanation
        ? { note: [{ text: procedure.explanation }] }
        : {}),
      text: narrative(
        'Procedure',
        [procedure.name, procedure.result, procedure.explanation].filter(
          Boolean,
        ),
      ),
    };
    return entry(resource);
  });

  const vitalEntries: Array<{ fullUrl: string; resource: FhirResource }> = [];
  for (const vital of snapshot.vitals) {
    const id = fhirId(idFactory);
    let code: Record<string, unknown>;
    let value: Record<string, unknown>;
    if (vital.key === 'blood-pressure') {
      const match = vital.value.match(
        /^\s*(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*$/,
      );
      if (!match) continue;
      code = {
        coding: [
          {
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel with all children optional',
          },
        ],
      };
      value = {
        component: [
          {
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '8480-6',
                  display: 'Systolic blood pressure',
                },
              ],
            },
            valueQuantity: {
              value: Number(match[1].replace(',', '.')),
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]',
            },
          },
          {
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '8462-4',
                  display: 'Diastolic blood pressure',
                },
              ],
            },
            valueQuantity: {
              value: Number(match[2].replace(',', '.')),
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]',
            },
          },
        ],
      };
    } else {
      const measurement = numeric(vital.value);
      if (measurement === null) continue;
      const definitions = {
        pulse: ['8867-4', 'Heart rate', '/min', '/min'],
        temperature: ['8310-5', 'Body temperature', '°C', 'Cel'],
        weight: ['29463-7', 'Body weight', 'kg', 'kg'],
        'oxygen-saturation': [
          '2708-6',
          'Oxygen saturation in Arterial blood',
          '%',
          '%',
        ],
      } as const;
      const [loinc, display, unit, ucum] = definitions[vital.key];
      code = { coding: [{ system: 'http://loinc.org', code: loinc, display }] };
      value = {
        valueQuantity: {
          value: measurement,
          unit,
          system: 'http://unitsofmeasure.org',
          code: ucum,
        },
      };
    }
    const resource: FhirResource = {
      resourceType: 'Observation',
      id,
      meta: {
        profile: ['http://hl7.org/fhir/StructureDefinition/vitalsigns'],
      },
      status: 'unknown',
      category: [
        {
          coding: [
            {
              system:
                'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
            },
          ],
        },
      ],
      code,
      subject: { reference: patientReference },
      ...(validFhirDate(vital.recordedDate)
        ? { effectiveDateTime: validFhirDate(vital.recordedDate) }
        : { _effectiveDateTime: dataAbsentReason('unknown') }),
      performer: [unknownPerformer()],
      ...value,
      text: narrative('Vital sign', [
        `${vital.label}: ${vital.value} ${vital.unit}`,
      ]),
    };
    vitalEntries.push(entry(resource));
  }

  let carePlanEntry: { fullUrl: string; resource: FhirResource } | null = null;
  if (snapshot.plan) {
    const id = fhirId(idFactory);
    const detail = [
      snapshot.plan.treatmentPlan,
      snapshot.plan.followUp,
      snapshot.plan.followUpDate
        ? `Follow-up date: ${snapshot.plan.followUpDate}`
        : '',
    ].filter(Boolean);
    carePlanEntry = entry({
      resourceType: 'CarePlan',
      id,
      status: 'unknown',
      intent: 'plan',
      subject: { reference: patientReference },
      ...(validFhirDate(snapshot.plan.recordedDate)
        ? { created: validFhirDate(snapshot.plan.recordedDate) }
        : {}),
      description: detail.join('\n'),
      text: narrative('Plan of care', detail),
    });
  }

  const problemLines = snapshot.conditions.map(
    (condition) =>
      `${condition.name}${condition.clinical_term ? ` (${condition.clinical_term})` : ''} · ${condition.status}`,
  );
  const allergyLines = snapshot.allergies.map(
    (allergy) =>
      `${allergy.substance} · ${allergy.reaction || 'reaction not recorded'} · ${allergy.severity}`,
  );
  const resultLines = snapshot.results.map((lab) =>
    `${lab.name}: ${lab.value} ${lab.unit} · ${lab.recordedDate}`.trim(),
  );
  const procedureLines = snapshot.procedures.map(
    (procedure) => `${procedure.name} · ${procedure.performedDate}`,
  );
  const vitalLines = snapshot.vitals.map(
    (vital) =>
      `${vital.label}: ${vital.value} ${vital.unit} · ${vital.recordedDate}`,
  );
  const carePlanLines = snapshot.plan
    ? [snapshot.plan.treatmentPlan, snapshot.plan.followUp].filter(Boolean)
    : [];
  const compositionSections = [
    section(
      'Problem List',
      '11450-4',
      problemLines,
      conditionEntries.map((item) => item.fullUrl),
      true,
    ),
    section(
      'Allergies and Intolerances',
      '48765-2',
      allergyLines,
      allergyEntries.map((item) => item.fullUrl),
      true,
    ),
    section(
      'Medication Summary',
      '10160-0',
      medicationLines,
      medicationStatementReferences,
      true,
    ),
    section(
      'Diagnostic Results',
      '30954-2',
      resultLines,
      resultEntries.map((item) => item.fullUrl),
    ),
    section(
      'History of Procedures',
      '47519-4',
      procedureLines,
      procedureEntries.map((item) => item.fullUrl),
    ),
    section(
      'Vital Signs',
      '8716-3',
      vitalLines,
      vitalEntries.map((item) => item.fullUrl),
    ),
    section(
      'Plan of Care',
      '18776-5',
      carePlanLines,
      carePlanEntry ? [carePlanEntry.fullUrl] : [],
    ),
  ].filter((value): value is Record<string, unknown> => value !== null);

  const composition: FhirResource = {
    resourceType: 'Composition',
    id: compositionId,
    meta: {
      profile: [
        'http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips',
      ],
    },
    identifier: {
      system: 'https://medipass.local/ips-document',
      value: bundleId,
    },
    status: 'preliminary',
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '60591-5',
          display: 'Patient summary Document',
        },
      ],
    },
    subject: { reference: patientReference },
    date: timestamp,
    author: [{ reference: organizationReference }],
    title: 'International Patient Summary — preliminary MediPass export',
    custodian: { reference: organizationReference },
    section: compositionSections,
    text: narrative('International Patient Summary', [
      'Preliminary, system-generated summary. Not clinician-attested.',
      `Source: ${snapshot.sourceLabel}`,
    ]),
  };

  return {
    resourceType: 'Bundle',
    id: bundleId,
    meta: { profile: [IPS_BUNDLE_PROFILE] },
    identifier: {
      system: 'https://medipass.local/ips-bundle',
      value: bundleId,
    },
    type: 'document',
    timestamp,
    entry: [
      entry(composition),
      entry(patient),
      entry(organization),
      ...conditionEntries,
      ...allergyEntries,
      ...medicationEntries,
      ...resultEntries,
      ...procedureEntries,
      ...vitalEntries,
      ...(carePlanEntry ? [carePlanEntry] : []),
    ],
  };
}
