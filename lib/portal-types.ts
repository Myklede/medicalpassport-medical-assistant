export type Condition = { id: string; name: string; clinical_term: string; since: string; status: string; note: string };
export type Allergy = { id: string; substance: string; reaction: string; severity: string; note: string };
export type Patient = {
  id: string; version: number; medical_record_number: string; display_name: string;
  birth_date: string; sex: string; blood_type: string; phone: string; email: string;
  address: string; emergency_contact: string; general_note: string; created_at: string; updated_at: string;
  conditions: Condition[]; allergies: Allergy[];
};
export type Clinician = { id: string; name: string; specialty: string; facility: string; public_phone: string; registration: string };
export type Lab = {
  id: string; name: string; plain_name: string; value: string; unit: string;
  reference_low: number | null; reference_high: number | null; reference_text: string;
  explanation: string; clinician_note: string; source_url: string;
};
export type Medicine = { id: string; name: string; dose: string; route: string; frequency: string; duration: string; status: string; instructions: string };
export type Procedure = { id: string; name: string; result: string; explanation: string };
export type Encounter = {
  id: string; patient_id: string; version: number; visit_date: string; reason: string; symptoms: string;
  diagnosis: string; plain_diagnosis: string; treatment_plan: string; follow_up: string; follow_up_date: string;
  blood_pressure: string; pulse: string; temperature: string; weight: string; oxygen_saturation: string;
  clinician: Clinician; labs: Lab[]; medications: Medicine[]; procedures: Procedure[];
  created_at: string; updated_at: string;
};
export type Feedback = {
  id: string; version: number; title: string; description: string; category: string; priority: string;
  status: string; page_path: string; section: string; patient_id: string; encounter_id: string;
  resolution: string; created_at: string; updated_at: string;
};
export type StorageStatus = { provider: 'supabase' | 'd1'; connected: boolean; project_url: string | null; label: string; schema_version: number };
export type PortalData = { patients: Patient[]; clinicians: Clinician[]; storage: StorageStatus; demo: true };
export const feedbackStatuses = { open: 'Mới gửi', planned: 'Đã ghi nhận', in_progress: 'Đang chỉnh sửa', done: 'Đã hoàn thành' } as const;
export const feedbackCategories = { interface: 'Giao diện', workflow: 'Luồng sử dụng', content: 'Nội dung', bug: 'Báo lỗi', other: 'Khác' } as const;
