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
  function close() { if (!saving && (!dirty || window.confirm('Bạn có thay đổi chưa lưu. Đóng biểu mẫu và bỏ các thay đổi này?'))) onClose(); }
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    try { const data = await api<{ patient: Patient }>('/api/portal/patients', value); onSaved(data.patient); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="mp-form-dialog sm:max-w-[850px]" showCloseButton={!saving}><DialogTitle>{initial.version ? 'Chỉnh sửa hồ sơ chung' : 'Thêm bệnh nhân'}</DialogTitle><DialogDescription>Bệnh nền và dị ứng được lưu tại đây, dùng chung cho các lần khám.</DialogDescription><form onSubmit={submit}>
    <fieldset disabled={saving} className="mp-form-fields"><div className="mp-form-grid">
      <Field label="Họ tên *"><Input value={value.display_name} required maxLength={160} onChange={e => change({ display_name: e.target.value })} /></Field>
      <Field label="Mã hồ sơ *"><Input value={value.medical_record_number} required maxLength={60} onChange={e => change({ medical_record_number: e.target.value })} /></Field>
      <Field label="Ngày sinh *"><Input type="date" value={value.birth_date} required max={new Date().toISOString().slice(0, 10)} onChange={e => change({ birth_date: e.target.value })} /></Field>
      <Field label="Giới tính"><select className="mp-input" value={value.sex} onChange={e => change({ sex: e.target.value })}><option value="unspecified">Chưa ghi nhận</option><option value="female">Nữ</option><option value="male">Nam</option><option value="other">Khác</option></select></Field>
      <Field label="Nhóm máu"><Input placeholder="VD: O+" value={value.blood_type} onChange={e => change({ blood_type: e.target.value })} /></Field>
      <Field label="Số điện thoại"><Input value={value.phone} onChange={e => change({ phone: e.target.value })} /></Field>
      <Field label="Email"><Input type="email" value={value.email} onChange={e => change({ email: e.target.value })} /></Field>
      <Field label="Địa chỉ"><Input value={value.address} onChange={e => change({ address: e.target.value })} /></Field>
      <Field label="Liên hệ khẩn cấp"><Input placeholder="Tên, quan hệ, số điện thoại" value={value.emergency_contact} onChange={e => change({ emergency_contact: e.target.value })} /></Field>
      <Field label="Ghi chú chung"><textarea className="mp-input" value={value.general_note} onChange={e => change({ general_note: e.target.value })} /></Field>
    </div>
    <div className="mp-form-section"><div className="mp-section-heading"><h3>Bệnh nền / tiền sử chung</h3><AddButton onClick={() => change({ conditions: [...value.conditions, { id: uid(), name: '', clinical_term: '', since: '', status: 'active', note: '' }] })}>Thêm bệnh nền</AddButton></div>
      {value.conditions.length === 0 && <p className="mp-muted">Chưa ghi nhận bệnh nền.</p>}{value.conditions.map((c, i) => { const update = (patch: Partial<typeof c>) => change({ conditions: value.conditions.map((x, j) => j === i ? { ...x, ...patch } : x) }); return <div className="mp-form-row" key={c.id}><div className="mp-row-title"><strong>Bệnh nền {i+1}</strong><RemoveButton label={`Bỏ bệnh nền ${i+1}`} onClick={() => change({ conditions: value.conditions.filter((_, j) => i !== j) })} /></div><div className="mp-form-grid"><Field label="Tên dễ hiểu *"><Input value={c.name} required onChange={e => update({ name: e.target.value })} /></Field><Field label="Thuật ngữ chuyên môn"><Input value={c.clinical_term} onChange={e => update({ clinical_term: e.target.value })} /></Field><Field label="Ghi nhận từ"><Input value={c.since} placeholder="VD: 2021" onChange={e => update({ since: e.target.value })} /></Field><Field label="Trạng thái"><select className="mp-input" value={c.status} onChange={e => update({ status: e.target.value })}><option value="active">Đang theo dõi</option><option value="resolved">Đã khỏi / tiền sử</option></select></Field></div><Field label="Ghi chú"><Input value={c.note} onChange={e => update({ note: e.target.value })} /></Field></div>; })}
    </div>
    <div className="mp-form-section"><div className="mp-section-heading"><h3>Dị ứng</h3><AddButton onClick={() => change({ allergies: [...value.allergies, { id: uid(), substance: '', reaction: '', severity: 'unknown', note: '' }] })}>Thêm dị ứng</AddButton></div>{value.allergies.length === 0 && <p className="mp-muted">Chưa ghi nhận dị ứng; không đồng nghĩa đã xác nhận không dị ứng.</p>}{value.allergies.map((a, i) => { const update = (patch: Partial<typeof a>) => change({ allergies: value.allergies.map((x, j) => j === i ? { ...x, ...patch } : x) }); return <div className="mp-form-row" key={a.id}><div className="mp-row-title"><strong>Dị ứng {i+1}</strong><RemoveButton label={`Bỏ dị ứng ${i+1}`} onClick={() => change({ allergies: value.allergies.filter((_, j) => i !== j) })} /></div><div className="mp-form-grid"><Field label="Thuốc / chất gây dị ứng *"><Input required value={a.substance} onChange={e => update({ substance: e.target.value })} /></Field><Field label="Phản ứng"><Input value={a.reaction} onChange={e => update({ reaction: e.target.value })} /></Field><Field label="Mức độ"><select className="mp-input" value={a.severity} onChange={e => update({ severity: e.target.value })}>{Object.entries(severityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Ghi chú"><Input value={a.note} onChange={e => update({ note: e.target.value })} /></Field></div></div>; })}</div>
    </fieldset><ErrorBox message={error} /><div className="mp-form-footer"><span>{dirty ? 'Có thay đổi chưa lưu' : 'Thông tin hồ sơ bệnh nhân'}</span><Button type="button" variant="outline" disabled={saving} onClick={close}>Hủy</Button><Button type="submit" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu hồ sơ chung'}</Button></div>
  </form></DialogContent></Dialog>;
}
