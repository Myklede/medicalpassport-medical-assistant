// Keep these additive cold-start definitions aligned with drizzle/0001_chilly_deathbird.sql.
// Existing tables and records are never replaced; applied migrations remain unchanged.
export const woundSchemaStatements = [
  `CREATE TABLE IF NOT EXISTS wound_cases (
    id TEXT PRIMARY KEY NOT NULL,
    patient_id TEXT NOT NULL,
    label TEXT NOT NULL,
    body_location TEXT NOT NULL,
    wound_type TEXT NOT NULL,
    onset_date TEXT,
    status TEXT NOT NULL,
    created_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id),
    FOREIGN KEY(created_by_user_id) REFERENCES app_users(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_wound_cases_patient_status
    ON wound_cases(patient_id, status)`,
  `CREATE TABLE IF NOT EXISTS wound_assessments (
    id TEXT PRIMARY KEY NOT NULL,
    wound_case_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    image_object_id TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    pain_score INTEGER NOT NULL,
    symptoms_json TEXT NOT NULL,
    capture_json TEXT NOT NULL,
    notes TEXT,
    triage_level TEXT NOT NULL,
    triage_reasons_json TEXT NOT NULL,
    history_factors_json TEXT NOT NULL,
    created_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY(wound_case_id) REFERENCES wound_cases(id),
    FOREIGN KEY(patient_id) REFERENCES patients(id),
    FOREIGN KEY(image_object_id) REFERENCES storage_objects(id),
    FOREIGN KEY(created_by_user_id) REFERENCES app_users(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_wound_assessments_case_date
    ON wound_assessments(wound_case_id, captured_at)`,
  `CREATE INDEX IF NOT EXISTS idx_wound_assessments_patient_date
    ON wound_assessments(patient_id, captured_at)`,
  `CREATE TABLE IF NOT EXISTS ai_inferences (
    id TEXT PRIMARY KEY NOT NULL,
    patient_id TEXT NOT NULL,
    wound_case_id TEXT NOT NULL,
    wound_assessment_id TEXT NOT NULL,
    task TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    status TEXT NOT NULL,
    output_json TEXT NOT NULL,
    confidence_json TEXT NOT NULL,
    input_manifest_json TEXT NOT NULL,
    requires_review INTEGER DEFAULT true NOT NULL,
    reviewed_by_user_id TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(patient_id) REFERENCES patients(id),
    FOREIGN KEY(wound_case_id) REFERENCES wound_cases(id),
    FOREIGN KEY(wound_assessment_id) REFERENCES wound_assessments(id),
    FOREIGN KEY(reviewed_by_user_id) REFERENCES app_users(id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ai_inferences_assessment
    ON ai_inferences(wound_assessment_id)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_inferences_patient_date
    ON ai_inferences(patient_id, created_at)`,
] as const;
