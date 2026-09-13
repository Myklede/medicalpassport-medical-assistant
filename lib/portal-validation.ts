import type { Patient, Encounter, Feedback, Clinician, Lab, Medicine, Procedure, Condition, Allergy } from './portal-types.ts';
import { feedbackCategories, feedbackStatuses } from './portal-types.ts';

export class PortalError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PortalError('Invalid data.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 2000, required = false): string {
  if (value !== undefined && value !== null && typeof value !== 'string') throw new PortalError('Invalid text field.');
  const result = (value as string | undefined)?.trim() ?? '';
  if (result.length > max) throw new PortalError(`Content exceeds ${max} characters.`);
  if (required && !result) throw new PortalError('Complete all required fields.');
  return result;
}
export function safeId(value: unknown, allowEmpty = false): string {
  const id = text(value, 100);
  if (!id && allowEmpty) return '';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new PortalError('Invalid record identifier.');
  return id;
}
function date(value: unknown, required = false): string {
  const result = text(value, 10, required);
  if (result && (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result)) throw new PortalError('Invalid date.');
  return result;
}
function choice(value: unknown, choices: string[], fallback: string): string {
  const result = text(value, 100) || fallback;
  if (!choices.includes(result)) throw new PortalError('Invalid selection.');
  return result;
}
function list<T>(value: unknown, convert: (item: Record<string, unknown>) => T, max = 60): T[] {
  if (!Array.isArray(value) || value.length > max) throw new PortalError(`The list can contain no more than ${max} items.`);
  const items = value.map(item => convert(object(item)));
  const ids = items.map(item => (item as { id?: string }).id);
  if (new Set(ids).size !== ids.length) throw new PortalError('The list contains duplicate item IDs. Re-add the duplicated item before saving.');
  return items;
}
function unique<T>(items: T[], key: (item: T) => string): T[] {
  const keys = items.map(item => key(item).trim().toLocaleLowerCase());
  if (new Set(keys).size !== keys.length) throw new PortalError('The list contains duplicate entries. Combine them before saving.');
  return items;
}
function version(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new PortalError('Invalid record version.');
  return Number(value);
}
function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new PortalError('The reference limit must be a valid number.');
  return value;
}
function sourceUrl(value: unknown): string {
  const raw = text(value, 500);
  if (!raw) return '';
  try { if (new URL(raw).protocol === 'https:') return raw; } catch { /* checked below */ }
  throw new PortalError('The source URL must use HTTPS.');
}
export function validatePatient(value: unknown): Patient {
  const v = object(value);
  const birthDate = date(v.birth_date, true);
  if (birthDate > new Date().toISOString().slice(0, 10)) throw new PortalError('Date of birth cannot be in the future.');
  return {
    id: safeId(v.id), version: version(v.version), medical_record_number: text(v.medical_record_number, 60, true), display_name: text(v.display_name, 160, true),
    birth_date: birthDate, sex: choice(v.sex, ['female', 'male', 'other', 'unspecified'], 'unspecified'), blood_type: text(v.blood_type, 15), phone: text(v.phone, 60), email: text(v.email, 180), address: text(v.address, 400), emergency_contact: text(v.emergency_contact, 250), general_note: text(v.general_note), created_at: '', updated_at: '',
    conditions: unique(list<Condition>(v.conditions, c => ({ id: safeId(c.id), name: text(c.name, 200, true), clinical_term: text(c.clinical_term, 250), since: text(c.since, 40), status: choice(c.status, ['active', 'resolved'], 'active'), note: text(c.note) })), c => c.name),
    allergies: unique(list<Allergy>(v.allergies, a => ({ id: safeId(a.id), substance: text(a.substance, 200, true), reaction: text(a.reaction, 300), severity: choice(a.severity, ['unknown', 'mild', 'moderate', 'severe'], 'unknown'), note: text(a.note) })), a => a.substance),
  };
}
function clinician(value: unknown): Clinician {
  const c = object(value);
  return { id: safeId(c.id), name: text(c.name, 160, true), specialty: text(c.specialty, 150), facility: text(c.facility, 200, true), public_phone: text(c.public_phone, 60), registration: text(c.registration, 100) };
}
export function validateEncounter(value: unknown): Encounter {
  const v = object(value);
  return { id: safeId(v.id), patient_id: safeId(v.patient_id), version: version(v.version), visit_date: date(v.visit_date, true), reason: text(v.reason, 250, true), symptoms: text(v.symptoms, 5000), diagnosis: text(v.diagnosis, 3000), plain_diagnosis: text(v.plain_diagnosis, 3000), treatment_plan: text(v.treatment_plan, 8000), follow_up: text(v.follow_up, 3000), follow_up_date: date(v.follow_up_date), blood_pressure: text(v.blood_pressure, 30), pulse: text(v.pulse, 15), temperature: text(v.temperature, 15), weight: text(v.weight, 15), oxygen_saturation: text(v.oxygen_saturation, 15), clinician: clinician(v.clinician), created_at: '', updated_at: '',
    labs: list<Lab>(v.labs, l => {
      const low = optionalNumber(l.reference_low), high = optionalNumber(l.reference_high);
      if (low !== null && high !== null && low > high) throw new PortalError('The lower limit cannot exceed the upper limit.');
      if ((low !== null || high !== null) && !text(l.unit, 60)) throw new PortalError('A unit is required when entering a reference range.');
      return { id: safeId(l.id), name: text(l.name, 200, true), plain_name: text(l.plain_name, 200), value: text(l.value, 150, true), unit: text(l.unit, 60), reference_low: low, reference_high: high, reference_text: text(l.reference_text, 500), explanation: text(l.explanation, 3000), clinician_note: text(l.clinician_note, 3000), source_url: sourceUrl(l.source_url) };
    }),
    medications: list<Medicine>(v.medications, m => ({ id: safeId(m.id), name: text(m.name, 200, true), dose: text(m.dose, 150), route: text(m.route, 80), frequency: text(m.frequency, 200), duration: text(m.duration, 200), status: choice(m.status, ['active', 'completed', 'stopped'], 'active'), instructions: text(m.instructions, 3000) })),
    procedures: list<Procedure>(v.procedures, p => ({ id: safeId(p.id), name: text(p.name, 250, true), result: text(p.result, 4000), explanation: text(p.explanation, 3000) })),
  };
}
export function validateFeedback(value: unknown): Feedback {
  const v = object(value);
  const path = text(v.page_path, 500);
  let annotation: Feedback['annotation'] = null;
  if (v.annotation != null) {
    const a = object(v.annotation);
    for (const key of ['x', 'y', 'viewport_width', 'viewport_height']) {
      if (typeof a[key] !== 'number' || !Number.isFinite(a[key])) throw new PortalError('Invalid pin position.');
    }
    if (Number(a.x) < 0 || Number(a.x) > 1 || Number(a.y) < 0 || Number(a.y) > 1 || Number(a.viewport_width) < 1 || Number(a.viewport_height) < 1) throw new PortalError('Invalid pin position.');
    annotation = { selector: text(a.selector, 2000, true), quote: text(a.quote, 500), x: Number(a.x), y: Number(a.y), viewport_width: Number(a.viewport_width), viewport_height: Number(a.viewport_height) };
  }
  if (path && (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || Array.from(path).some(character => character.charCodeAt(0) < 32))) throw new PortalError('The feedback location must belong to this website.');
  return { id: safeId(v.id), version: version(v.version), title: text(v.title, 160, true), description: text(v.description, 8000, true), category: choice(v.category, Object.keys(feedbackCategories), 'interface'), priority: choice(v.priority, ['normal', 'high'], 'normal'), status: choice(v.status, Object.keys(feedbackStatuses), 'open'), page_path: path, section: text(v.section, 200), patient_id: safeId(v.patient_id, true), encounter_id: safeId(v.encounter_id, true), resolution: text(v.resolution, 5000), annotation, created_at: '', updated_at: '' };
}
