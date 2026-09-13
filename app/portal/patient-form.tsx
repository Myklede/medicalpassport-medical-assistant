'use client';
import { useState, type SyntheticEvent } from 'react';
import type { Patient } from '@/lib/portal-types';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AddButton, RemoveButton, Field, Input, ErrorBox, uid, api, severityLabels } from './portal-ui';

export function blankPatient(): Patient {
  return { id: uid(), version: 0, medical_record_number: `MP-${Date.now().toString().slice(-7)}`, display_name: '', birth_date: '', sex: 'unspecified', blood_type: '', phone: '', email: '', address: '', emergency_contact: '', general_note: '', conditions: [], allergies: [], created_at: '', updated_at: '' };
}
export function PatientForm({ initial, onClose, onSaved }: { initial: Patient; onClose: () => void; onSaved: (patient: Patient) => void }) {
  const [value, setValue] = useState<Patient>(structuredClone(initial));
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [dirty, setDirty] = useState(false);
  function change(patch: Partial<Patient>) { setDirty(true); setValue(old => ({ ...old, ...patch })); }
  function close() { if (!saving && (!dirty || window.confirm('You have unsaved changes. Close the form and discard them?'))) onClose(); }
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    try { const data = await api<{ patient: Patient }>('/api/portal/patients', value); onSaved(data.patient); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="mp-form-dialog sm:max-w-[850px]" showCloseButton={!saving}><DialogTitle>{initial.version ? 'Edit shared record' : 'Add patient'}</DialogTitle><DialogDescription>Conditions and allergies are stored here and shared across visits.</DialogDescription><form onSubmit={submit}>
    <fieldset disabled={saving} className="mp-form-fields"><div className="mp-form-grid">
      <Field label="Full name *"><Input value={value.display_name} required maxLength={160} onChange={e => change({ display_name: e.target.value })} /></Field>
      <Field label="Record number *"><Input value={value.medical_record_number} required maxLength={60} onChange={e => change({ medical_record_number: e.target.value })} /></Field>
      <Field label="Date of birth *"><Input type="date" value={value.birth_date} required max={new Date().toISOString().slice(0, 10)} onChange={e => change({ birth_date: e.target.value })} /></Field>
      <Field label="Sex"><select className="mp-input" value={value.sex} onChange={e => change({ sex: e.target.value })}><option value="unspecified">Not recorded</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></Field>
      <Field label="Blood type"><Input placeholder="Example: O+" value={value.blood_type} onChange={e => change({ blood_type: e.target.value })} /></Field>
      <Field label="Phone"><Input value={value.phone} onChange={e => change({ phone: e.target.value })} /></Field>
      <Field label="Email"><Input type="email" value={value.email} onChange={e => change({ email: e.target.value })} /></Field>
      <Field label="Address"><Input value={value.address} onChange={e => change({ address: e.target.value })} /></Field>
      <Field label="Emergency contact"><Input placeholder="Name, relationship, phone number" value={value.emergency_contact} onChange={e => change({ emergency_contact: e.target.value })} /></Field>
      <Field label="General note"><textarea className="mp-input" value={value.general_note} onChange={e => change({ general_note: e.target.value })} /></Field>
    </div>
    <div className="mp-form-section"><div className="mp-section-heading"><h3>Shared conditions / medical history</h3><AddButton onClick={() => change({ conditions: [...value.conditions, { id: uid(), name: '', clinical_term: '', since: '', status: 'active', note: '' }] })}>Add condition</AddButton></div>
      {value.conditions.length === 0 && <p className="mp-muted">No conditions recorded.</p>}{value.conditions.map((c, i) => { const update = (patch: Partial<typeof c>) => change({ conditions: value.conditions.map((x, j) => j === i ? { ...x, ...patch } : x) }); return <div className="mp-form-row" key={c.id}><div className="mp-row-title"><strong>Condition {i+1}</strong><RemoveButton label={`Remove condition ${i+1}`} onClick={() => change({ conditions: value.conditions.filter((_, j) => i !== j) })} /></div><div className="mp-form-grid"><Field label="Plain-language name *"><Input value={c.name} required onChange={e => update({ name: e.target.value })} /></Field><Field label="Clinical term"><Input value={c.clinical_term} onChange={e => update({ clinical_term: e.target.value })} /></Field><Field label="Recorded since"><Input value={c.since} placeholder="Example: 2021" onChange={e => update({ since: e.target.value })} /></Field><Field label="Status"><select className="mp-input" value={c.status} onChange={e => update({ status: e.target.value })}><option value="active">Active monitoring</option><option value="resolved">Resolved / history</option></select></Field></div><Field label="Note"><Input value={c.note} onChange={e => update({ note: e.target.value })} /></Field></div>; })}
    </div>
    <div className="mp-form-section"><div className="mp-section-heading"><h3>Allergies</h3><AddButton onClick={() => change({ allergies: [...value.allergies, { id: uid(), substance: '', reaction: '', severity: 'unknown', note: '' }] })}>Add allergy</AddButton></div>{value.allergies.length === 0 && <p className="mp-muted">No allergies recorded; this does not mean that absence of allergies has been confirmed.</p>}{value.allergies.map((a, i) => { const update = (patch: Partial<typeof a>) => change({ allergies: value.allergies.map((x, j) => j === i ? { ...x, ...patch } : x) }); return <div className="mp-form-row" key={a.id}><div className="mp-row-title"><strong>Allergy {i+1}</strong><RemoveButton label={`Remove allergy ${i+1}`} onClick={() => change({ allergies: value.allergies.filter((_, j) => i !== j) })} /></div><div className="mp-form-grid"><Field label="Medication / allergen *"><Input required value={a.substance} onChange={e => update({ substance: e.target.value })} /></Field><Field label="Reaction"><Input value={a.reaction} onChange={e => update({ reaction: e.target.value })} /></Field><Field label="Severity"><select className="mp-input" value={a.severity} onChange={e => update({ severity: e.target.value })}>{Object.entries(severityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Note"><Input value={a.note} onChange={e => update({ note: e.target.value })} /></Field></div></div>; })}</div>
    </fieldset><ErrorBox message={error} /><div className="mp-form-footer"><span>{dirty ? 'Unsaved changes' : 'Patient record information'}</span><Button type="button" variant="outline" disabled={saving} onClick={close}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save shared record'}</Button></div>
  </form></DialogContent></Dialog>;
}
