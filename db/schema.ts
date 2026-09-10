import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const appUsers = sqliteTable('app_users', {
  id: text('id').primaryKey(),
  authSubject: text('auth_subject').notNull().unique(),
  email: text('email'),
  displayName: text('display_name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const patients = sqliteTable('patients', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  birthDate: text('birth_date'),
  bloodType: text('blood_type'),
  preferredLanguage: text('preferred_language'),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const patientMemberships = sqliteTable(
  'patient_memberships',
  {
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    userId: text('user_id')
      .notNull()
      .references(() => appUsers.id),
    role: text('role').notNull(),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull(),
    revokedAt: text('revoked_at'),
  },
  (table) => [
    primaryKey({ columns: [table.patientId, table.userId] }),
    index('idx_membership_user').on(table.userId, table.status),
  ],
);

export const storageObjects = sqliteTable(
  'storage_objects',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    objectKey: text('object_key').notNull().unique(),
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    byteSize: text('byte_size').notNull(),
    purpose: text('purpose').notNull(),
    uploadedByUserId: text('uploaded_by_user_id')
      .notNull()
      .references(() => appUsers.id),
    createdAt: text('created_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [index('idx_storage_patient').on(table.patientId, table.createdAt)],
);

export const healthRecords = sqliteTable(
  'health_records',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    recordType: text('record_type').notNull(),
    fhirResourceType: text('fhir_resource_type').notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    status: text('status').notNull(),
    clinicalDate: text('clinical_date').notNull(),
    provider: text('provider'),
    facility: text('facility'),
    countryCode: text('country_code'),
    codeSystem: text('code_system'),
    code: text('code'),
    source: text('source').notNull(),
    verificationStatus: text('verification_status').notNull(),
    severity: text('severity'),
    detailsJson: text('details_json').notNull(),
    attachmentId: text('attachment_id').references(() => storageObjects.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    index('idx_records_patient_date').on(table.patientId, table.clinicalDate),
    index('idx_records_patient_type').on(table.patientId, table.recordType),
    index('idx_records_patient_status').on(table.patientId, table.status),
  ],
);

export const woundCases = sqliteTable(
  'wound_cases',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    label: text('label').notNull(),
    bodyLocation: text('body_location').notNull(),
    woundType: text('wound_type').notNull(),
    onsetDate: text('onset_date'),
    status: text('status').notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => appUsers.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    index('idx_wound_cases_patient_status').on(table.patientId, table.status),
  ],
);

export const woundAssessments = sqliteTable(
  'wound_assessments',
  {
    id: text('id').primaryKey(),
    woundCaseId: text('wound_case_id')
      .notNull()
      .references(() => woundCases.id),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    imageObjectId: text('image_object_id')
      .notNull()
      .references(() => storageObjects.id),
    capturedAt: text('captured_at').notNull(),
    painScore: integer('pain_score').notNull(),
    symptomsJson: text('symptoms_json').notNull(),
    captureJson: text('capture_json').notNull(),
    notes: text('notes'),
    triageLevel: text('triage_level').notNull(),
    triageReasonsJson: text('triage_reasons_json').notNull(),
    historyFactorsJson: text('history_factors_json').notNull(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => appUsers.id),
    createdAt: text('created_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    index('idx_wound_assessments_case_date').on(
      table.woundCaseId,
      table.capturedAt,
    ),
    index('idx_wound_assessments_patient_date').on(
      table.patientId,
      table.capturedAt,
    ),
  ],
);

export const aiInferences = sqliteTable(
  'ai_inferences',
  {
    id: text('id').primaryKey(),
    patientId: text('patient_id')
      .notNull()
      .references(() => patients.id),
    woundCaseId: text('wound_case_id')
      .notNull()
      .references(() => woundCases.id),
    woundAssessmentId: text('wound_assessment_id')
      .notNull()
      .references(() => woundAssessments.id),
    task: text('task').notNull(),
    modelName: text('model_name').notNull(),
    modelVersion: text('model_version').notNull(),
    status: text('status').notNull(),
    outputJson: text('output_json').notNull(),
    confidenceJson: text('confidence_json').notNull(),
    inputManifestJson: text('input_manifest_json').notNull(),
    requiresReview: integer('requires_review', { mode: 'boolean' })
      .notNull()
      .default(true),
    reviewedByUserId: text('reviewed_by_user_id').references(() => appUsers.id),
    reviewedAt: text('reviewed_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_ai_inferences_assessment').on(table.woundAssessmentId),
    index('idx_ai_inferences_patient_date').on(table.patientId, table.createdAt),
  ],
);

export const auditEvents = sqliteTable(
  'audit_events',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').references(() => appUsers.id),
    patientId: text('patient_id').references(() => patients.id),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    outcome: text('outcome').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_audit_patient_date').on(table.patientId, table.createdAt)],
);

// Local/private demo staging. Supabase uses normalized clinical tables; these
// documents preserve edits until the user connects their Supabase project.
export const portalSpaces = sqliteTable('portal_spaces', {
  id: text('id').primaryKey(),
  seededAt: text('seeded_at').notNull(),
});

export const portalDocuments = sqliteTable('portal_documents', {
  workspaceId: text('workspace_id').notNull().references(() => portalSpaces.id),
  kind: text('kind').notNull(),
  id: text('id').notNull(),
  version: integer('version').notNull(),
  payload: text('payload').notNull(),
  mutationId: text('mutation_id').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [primaryKey({ columns: [table.workspaceId, table.kind, table.id] })]);

export const portalChanges = sqliteTable('portal_changes', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => portalSpaces.id),
  kind: text('kind').notNull(),
  resourceId: text('resource_id').notNull(),
  action: text('action').notNull(),
  createdAt: text('created_at').notNull(),
}, table => [index('idx_portal_changes_workspace_date').on(table.workspaceId, table.createdAt)]);
