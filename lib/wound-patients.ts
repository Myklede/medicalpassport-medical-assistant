/** Frontend-only demo database. This is not authentication or the Supabase portal. */
export type WoundPatient = Readonly<{
  patient_id: string; display_name: string; age: number; blood_type: string;
  hba1c_level: number; has_diabetes_type_2: boolean; hypertension: boolean;
}>;

export const MOCK_WOUND_PATIENTS: readonly WoundPatient[] = Object.freeze([
  Object.freeze({ patient_id: 'SYN000014', display_name: 'An Nguyễn', age: 20, blood_type: 'A-', hba1c_level: 9.6, has_diabetes_type_2: true, hypertension: false }),
  Object.freeze({ patient_id: 'MOCK-002', display_name: 'Bình Trần', age: 34, blood_type: 'O+', hba1c_level: 5.2, has_diabetes_type_2: false, hypertension: false }),
  Object.freeze({ patient_id: 'MOCK-003', display_name: 'Chi Lê', age: 67, blood_type: 'B+', hba1c_level: 7.1, has_diabetes_type_2: true, hypertension: true }),
  Object.freeze({ patient_id: 'MOCK-004', display_name: 'Dung Phạm', age: 49, blood_type: 'AB-', hba1c_level: 5.6, has_diabetes_type_2: false, hypertension: true }),
  Object.freeze({ patient_id: 'MOCK-005', display_name: 'Hải Võ', age: 81, blood_type: 'O-', hba1c_level: 10.4, has_diabetes_type_2: true, hypertension: true }),
]);

// Simulated signed-in user; mode changes cannot substitute the developer selection.
export const PATIENT_MODE_PROFILE = MOCK_WOUND_PATIENTS[0];

export function woundBaseline(patient: WoundPatient) {
  const { patient_id, age, blood_type, hba1c_level, has_diabetes_type_2, hypertension } = patient;
  return { patient_id, age, blood_type, hba1c_level, has_diabetes_type_2, hypertension };
}
