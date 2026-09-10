'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Patient, Encounter, Clinician, Feedback } from '@/lib/portal-types';
import { feedbackStatuses } from '@/lib/portal-types';
import { formatDate, medicineLabels } from '../portal/portal-ui';
import { referenceLabel } from '@/lib/lab-interpretation';

export type DataSnapshot = { patients: Patient[]; encounters: Encounter[]; clinicians: Clinician[]; feedback: Feedback[]; checked_at: string };
type Row = { id: string; cells: string[]; href: string };
export function DataExplorer({ data }: { data: DataSnapshot }) {
  const [patientId, setPatientId] = useState('all'), [category, setCategory] = useState('patients');
  const patients = data.patients.filter(p => patientId === 'all' || p.id === patientId);
  const visits = data.encounters.filter(e => patientId === 'all' || e.patient_id === patientId);
  const patientName = (id: string) => data.patients.find(p => p.id === id)?.display_name || 'Toàn website';
  const visitLink = (e: Encounter) => `/visit/${e.id}?patient=${e.patient_id}`;
  const groups: { id: string; label: string; columns: string[]; rows: Row[] }[] = [
    { id: 'patients', label: 'Bệnh nhân', columns: ['Mã hồ sơ', 'Họ tên', 'Ngày sinh', 'Lần lưu gần nhất'], rows: patients.map(p => ({ id: p.id, cells: [p.medical_record_number, p.display_name, formatDate(p.birth_date), formatDate(p.updated_at)], href: `/editor?patient=${p.id}` })) },
    { id: 'conditions', label: 'Bệnh nền', columns: ['Bệnh nhân', 'Tên dễ hiểu', 'Thuật ngữ', 'Ghi chú'], rows: patients.flatMap(p => p.conditions.map(c => ({ id: `${p.id}-${c.id}`, cells: [p.display_name, c.name, c.clinical_term, c.note], href: `/patient?patient=${p.id}` }))) },
    { id: 'allergies', label: 'Dị ứng', columns: ['Bệnh nhân', 'Chất gây dị ứng', 'Phản ứng', 'Ghi chú'], rows: patients.flatMap(p => p.allergies.map(a => ({ id: `${p.id}-${a.id}`, cells: [p.display_name, a.substance, a.reaction, a.note], href: `/patient?patient=${p.id}` }))) },
    { id: 'visits', label: 'Lần khám', columns: ['Bệnh nhân', 'Ngày khám', 'Lý do', 'Bác sĩ'], rows: visits.map(e => ({ id: e.id, cells: [patientName(e.patient_id), formatDate(e.visit_date), e.reason, e.clinician.name], href: visitLink(e) })) },
    { id: 'labs', label: 'Xét nghiệm', columns: ['Bệnh nhân · ngày khám', 'Xét nghiệm', 'Kết quả', 'Khoảng trên phiếu'], rows: visits.flatMap(e => e.labs.map(l => ({ id: `${e.id}-${l.id}`, cells: [`${patientName(e.patient_id)} · ${formatDate(e.visit_date)}`, l.name, `${l.value} ${l.unit}`, referenceLabel(l)], href: visitLink(e) }))) },
    { id: 'medications', label: 'Thuốc', columns: ['Bệnh nhân · ngày khám', 'Thuốc · liều', 'Cách dùng', 'Trạng thái'], rows: visits.flatMap(e => e.medications.map(m => ({ id: `${e.id}-${m.id}`, cells: [`${patientName(e.patient_id)} · ${formatDate(e.visit_date)}`, `${m.name} · ${m.dose}`, [m.route, m.frequency].filter(Boolean).join(' · '), medicineLabels[m.status]], href: visitLink(e) }))) },
    { id: 'procedures', label: 'Dịch vụ', columns: ['Bệnh nhân · ngày khám', 'Dịch vụ', 'Kết quả'], rows: visits.flatMap(e => e.procedures.map(p => ({ id: `${e.id}-${p.id}`, cells: [`${patientName(e.patient_id)} · ${formatDate(e.visit_date)}`, p.name, p.result], href: visitLink(e) }))) },
    { id: 'clinicians', label: 'Bác sĩ', columns: ['Tên bác sĩ', 'Chuyên khoa', 'Cơ sở', 'Liên hệ công khai'], rows: data.clinicians.filter(c => patientId === 'all' || visits.some(e => e.clinician.id === c.id)).map(c => ({ id: c.id, cells: [c.name, c.specialty, c.facility, c.public_phone], href: '/editor' })) },
    { id: 'feedback', label: 'Góp ý', columns: ['Tiêu đề', 'Khu vực', 'Trạng thái', 'Ngày gửi'], rows: data.feedback.filter(f => patientId === 'all' || f.patient_id === patientId).map(f => ({ id: f.id, cells: [f.title, f.section, feedbackStatuses[f.status as keyof typeof feedbackStatuses], formatDate(f.created_at)], href: '/feedback' })) },
  ];
  const group = groups.find(g => g.id === category)!;
  return <section className="mp-data-explorer mp-panel">
    <div className="mp-section-heading"><div><h2>Dữ liệu đã lưu</h2><p>Mở một dòng để xem hồ sơ đầy đủ. Bấm “Kiểm tra kết nối” để đọc lại dữ liệu từ máy chủ.</p></div><label>Lọc bệnh nhân<select className="mp-input" value={patientId} onChange={e => setPatientId(e.target.value)}><option value="all">Tất cả bệnh nhân</option>{data.patients.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label></div>
    <div className="mp-data-categories" aria-label="Nhóm dữ liệu">{groups.map(g => <button key={g.id} type="button" aria-pressed={category === g.id} onClick={() => setCategory(g.id)}>{g.label}<span>{g.rows.length}</span></button>)}</div>
    <Table><TableHeader><TableRow>{group.columns.map(c => <TableHead key={c}>{c}</TableHead>)}<TableHead>Hồ sơ</TableHead></TableRow></TableHeader><TableBody>{group.rows.map(r => <TableRow key={r.id}>{r.cells.map((cell, i) => <TableCell key={i}>{cell || 'Chưa ghi nhận'}</TableCell>)}<TableCell><Link className="mp-text-action" href={r.href}>Mở ↗</Link></TableCell></TableRow>)}{!group.rows.length && <TableRow><TableCell colSpan={group.columns.length + 1}>Chưa có dữ liệu trong nhóm này.</TableCell></TableRow>}</TableBody></Table>
    <p className="mp-footnote">Đọc từ máy chủ lúc {new Date(data.checked_at).toLocaleString('vi-VN')} · {group.rows.length} mục</p>
  </section>;
}
