import { env } from 'cloudflare:workers';
import { woundSchemaStatements } from '@/db/wound-schema';

export type PatientContext = {
  userId: string;
  patientId: string;
  userDisplayName: string;
  role: 'owner' | 'patient' | 'caregiver';
  patient: {
    id: string;
    display_name: string;
    birth_date: string | null;
    blood_type: string | null;
    preferred_language: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  };
};

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS app_users (
    id TEXT PRIMARY KEY,
    auth_subject TEXT NOT NULL UNIQUE,
    email TEXT,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    birth_date TEXT,
    blood_type TEXT,
    preferred_language TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS patient_memberships (
    patient_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'patient', 'caregiver')),
    status TEXT NOT NULL CHECK(status IN ('active', 'invited', 'revoked')),
    created_at TEXT NOT NULL,
    revoked_at TEXT,
    PRIMARY KEY(patient_id, user_id),
    FOREIGN KEY(patient_id) REFERENCES patients(id),
    FOREIGN KEY(user_id) REFERENCES app_users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS storage_objects (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    byte_size TEXT NOT NULL,
    purpose TEXT NOT NULL,
    uploaded_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id),
    FOREIGN KEY(uploaded_by_user_id) REFERENCES app_users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS health_records (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    record_type TEXT NOT NULL CHECK(record_type IN ('allergy', 'condition', 'medication', 'lab', 'encounter')),
    fhir_resource_type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT NOT NULL,
    clinical_date TEXT NOT NULL,
    provider TEXT,
    facility TEXT,
    country_code TEXT,
    code_system TEXT,
    code TEXT,
    source TEXT NOT NULL,
    verification_status TEXT NOT NULL,
    severity TEXT,
    details_json TEXT NOT NULL DEFAULT '{}',
    attachment_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id),
    FOREIGN KEY(attachment_id) REFERENCES storage_objects(id)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT,
    patient_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    outcome TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(actor_user_id) REFERENCES app_users(id),
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_membership_user ON patient_memberships(user_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_storage_patient ON storage_objects(patient_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_records_patient_date ON health_records(patient_id, clinical_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_records_patient_type ON health_records(patient_id, record_type)`,
  `CREATE INDEX IF NOT EXISTS idx_records_patient_status ON health_records(patient_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_patient_date ON audit_events(patient_id, created_at DESC)`,
  ...woundSchemaStatements,
];

let initialization: Promise<void> | null = null;

export async function ensureDatabase(): Promise<void> {
  if (!env.DB) throw new Error('The D1 database binding is unavailable.');
  if (!initialization) {
    initialization = env.DB
      .batch(schemaStatements.map((statement) => env.DB.prepare(statement)))
      .then(() => undefined)
      .catch((error) => {
        initialization = null;
        throw error;
      });
  }
  await initialization;
}

function identityFromRequest(request: Request) {
  const subject =
    request.headers.get('oai-authenticated-user-id') ?? 'medipass-demo-user';
  const email =
    request.headers.get('oai-authenticated-user-email') ??
    'demo-user@medipass.local';
  const encodedName = request.headers.get('oai-authenticated-user-full-name');
  const encoding = request.headers.get(
    'oai-authenticated-user-full-name-encoding',
  );
  let displayName = email;
  if (encodedName && encoding === 'percent-encoded-utf-8') {
    try {
      displayName = decodeURIComponent(encodedName);
    } catch {
      displayName = email;
    }
  }
  return { subject, email, displayName };
}

export async function getPatientContext(
  request: Request,
): Promise<PatientContext> {
  await ensureDatabase();
  const identity = identityFromRequest(request);
  const now = new Date().toISOString();

  let user = await env.DB.prepare(
    `SELECT id, display_name FROM app_users WHERE auth_subject = ? LIMIT 1`,
  )
    .bind(identity.subject)
    .first<{ id: string; display_name: string }>();

  if (!user) {
    const userId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO app_users
       (id, auth_subject, email, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(userId, identity.subject, identity.email, identity.displayName, now, now)
      .run();
    user = await env.DB.prepare(
      `SELECT id, display_name FROM app_users WHERE auth_subject = ? LIMIT 1`,
    )
      .bind(identity.subject)
      .first<{ id: string; display_name: string }>();
  }
  if (!user) throw new Error('Unable to resolve the signed-in demo user.');

  let patient = await env.DB.prepare(
    `SELECT p.id, p.display_name, p.birth_date, p.blood_type,
            p.preferred_language, p.emergency_contact_name,
            p.emergency_contact_phone
     FROM patients p
     INNER JOIN patient_memberships pm ON pm.patient_id = p.id
     WHERE pm.user_id = ? AND pm.status = 'active'
     ORDER BY pm.created_at ASC
     LIMIT 1`,
  )
    .bind(user.id)
    .first<PatientContext['patient']>();

  if (!patient) {
    const patientId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO patients
         (id, display_name, birth_date, blood_type, preferred_language,
          emergency_contact_name, emergency_contact_phone, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        patientId,
        'Alex Morgan',
        '1998-02-14',
        'O positive',
        'English',
        'Jordan Morgan',
        '(716) 555-0147',
        now,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO patient_memberships
         (patient_id, user_id, role, status, created_at, revoked_at)
         VALUES (?, ?, 'owner', 'active', ?, NULL)`,
      ).bind(patientId, user.id, now),
    ]);
    patient = await env.DB.prepare(
      `SELECT id, display_name, birth_date, blood_type, preferred_language,
              emergency_contact_name, emergency_contact_phone
       FROM patients WHERE id = ?`,
    )
      .bind(patientId)
      .first<PatientContext['patient']>();
  }
  if (!patient) throw new Error('Unable to create the demo patient.');

  const count = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM health_records
     WHERE patient_id = ? AND deleted_at IS NULL`,
  )
    .bind(patient.id)
    .first<{ total: number }>();
  if (!count?.total) await seedDemoRecords(user.id, patient.id);

  const membership = await env.DB.prepare(
    `SELECT role FROM patient_memberships
     WHERE patient_id = ? AND user_id = ? AND status = 'active'
     LIMIT 1`,
  )
    .bind(patient.id, user.id)
    .first<{ role: PatientContext['role'] }>();
  if (!membership) throw new Error('No active patient access was found.');

  return {
    userId: user.id,
    patientId: patient.id,
    userDisplayName: user.display_name,
    role: membership.role,
    patient,
  };
}

export function canManagePatient(context: Pick<PatientContext, 'role'>) {
  return context.role === 'owner' || context.role === 'caregiver';
}

type DemoSeed = {
  recordType: 'allergy' | 'condition' | 'medication' | 'lab' | 'encounter';
  fhirType: string;
  title: string;
  summary: string;
  status: string;
  date: string;
  provider?: string;
  facility?: string;
  codeSystem?: string;
  code?: string;
  severity?: string;
  details: Record<string, string>;
};

const demoSeeds: DemoSeed[] = [
  {
    recordType: 'allergy',
    fhirType: 'AllergyIntolerance',
    title: 'Penicillin',
    summary: 'Hives after exposure; avoid penicillin-class antibiotics.',
    status: 'active',
    date: '2012-06-10',
    severity: 'high',
    details: { reaction: 'Hives', category: 'Medication', criticality: 'High' },
  },
  {
    recordType: 'allergy',
    fhirType: 'AllergyIntolerance',
    title: 'Latex',
    summary: 'Contact irritation reported with latex gloves.',
    status: 'active',
    date: '2018-03-21',
    severity: 'moderate',
    details: { reaction: 'Skin irritation', category: 'Environment' },
  },
  {
    recordType: 'condition',
    fhirType: 'Condition',
    title: 'Essential hypertension',
    summary: 'Controlled with current treatment plan.',
    status: 'active',
    date: '2023-01-12',
    provider: 'Dr. Sarah Patel',
    facility: 'Amherst Family Medicine',
    codeSystem: 'ICD-10-CM',
    code: 'I10',
    severity: 'moderate',
    details: { category: 'Chronic', verification: 'Confirmed' },
  },
  {
    recordType: 'condition',
    fhirType: 'Condition',
    title: 'Seasonal asthma',
    summary: 'Mild intermittent symptoms, typically during spring allergy season.',
    status: 'active',
    date: '2010-04-18',
    codeSystem: 'ICD-10-CM',
    code: 'J45.20',
    severity: 'low',
    details: { category: 'Chronic', verification: 'Confirmed' },
  },
  {
    recordType: 'medication',
    fhirType: 'MedicationStatement',
    title: 'Lisinopril 10 mg',
    summary: 'Take one tablet by mouth once daily.',
    status: 'active',
    date: '2026-07-22',
    provider: 'Dr. Sarah Patel',
    facility: 'Amherst Family Medicine',
    details: { ingredient: 'Lisinopril', strength: '10 mg', frequency: 'Once daily' },
  },
  {
    recordType: 'medication',
    fhirType: 'MedicationStatement',
    title: 'Albuterol inhaler',
    summary: 'Two puffs as needed for wheezing.',
    status: 'active',
    date: '2026-05-10',
    details: { ingredient: 'Albuterol', strength: '90 mcg/actuation', frequency: 'As needed' },
  },
  {
    recordType: 'medication',
    fhirType: 'MedicationStatement',
    title: 'Vitamin D3',
    summary: 'One capsule with breakfast.',
    status: 'active',
    date: '2026-02-03',
    details: { ingredient: 'Cholecalciferol', strength: '1,000 IU', frequency: 'Once daily' },
  },
  {
    recordType: 'lab',
    fhirType: 'Observation',
    title: 'Hemoglobin',
    summary: '13.7 g/dL (entered reference range 12.0–16.0 g/dL).',
    status: 'final',
    date: '2026-08-14',
    facility: 'Buffalo Clinical Laboratory',
    codeSystem: 'LOINC',
    code: '718-7',
    details: { value: '13.7', unit: 'g/dL', referenceRange: '12.0–16.0', specimen: 'Blood' },
  },
  {
    recordType: 'encounter',
    fhirType: 'Encounter',
    title: 'Annual wellness visit',
    summary: 'Routine preventive visit; medications reconciled and blood pressure reviewed.',
    status: 'finished',
    date: '2026-08-28',
    provider: 'Dr. Sarah Patel',
    facility: 'Amherst Family Medicine',
    details: { visitType: 'Primary care', followUp: 'Return in 12 months' },
  },
];

async function seedDemoRecords(userId: string, patientId: string) {
  const now = new Date().toISOString();
  const insertSql = `INSERT INTO health_records
    (id, patient_id, record_type, fhir_resource_type, title, summary, status,
     clinical_date, provider, facility, country_code, code_system, code, source,
     verification_status, severity, details_json, attachment_id, created_at,
     updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`;
  await env.DB.batch(
    demoSeeds.map((seed) =>
      env.DB.prepare(insertSql).bind(
        crypto.randomUUID(),
        patientId,
        seed.recordType,
        seed.fhirType,
        seed.title,
        seed.summary,
        seed.status,
        seed.date,
        seed.provider ?? null,
        seed.facility ?? null,
        'US',
        seed.codeSystem ?? null,
        seed.code ?? null,
        'Synthetic demo data',
        'unverified',
        seed.severity ?? null,
        JSON.stringify(seed.details),
        now,
        now,
      ),
    ),
  );
  await writeAudit(
    { userId, patientId } as PatientContext,
    'seed',
    'Patient',
    patientId,
  );
}

export async function writeAudit(
  context: Pick<PatientContext, 'userId' | 'patientId'>,
  action: string,
  resourceType: string,
  resourceId: string | null,
  outcome = 'success',
) {
  await env.DB.prepare(
    `INSERT INTO audit_events
     (id, actor_user_id, patient_id, action, resource_type, resource_id, outcome, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      context.userId,
      context.patientId,
      action,
      resourceType,
      resourceId,
      outcome,
      new Date().toISOString(),
    )
    .run();
}
