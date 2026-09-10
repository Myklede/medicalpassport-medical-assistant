'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, HeartPulse, Printer } from 'lucide-react';
import type { Encounter, Patient, PortalData } from '@/lib/portal-types';
import { Button } from '@/components/ui/button';
import { api, Busy, ErrorBox, formatDate } from './portal-ui';
import { EncounterDetail } from './encounter-detail';

export function VisitPage({ encounterId }: { encounterId: string }) {
  const [patient, setPatient] = useState<Patient | null>(null), [encounter, setEncounter] = useState<Encounter | null>(null), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const patientId = new URLSearchParams(window.location.search).get('patient');
        if (!patientId) throw new Error('Thiếu mã bệnh nhân. Hãy mở bản in từ thẻ lần khám.');
        const [portal, result] = await Promise.all([api<PortalData>('/api/portal', undefined, controller.signal), api<{ encounters: Encounter[] }>(`/api/portal/encounters?patient_id=${encodeURIComponent(patientId)}`, undefined, controller.signal)]);
        const p = portal.patients.find(x => x.id === patientId), e = result.encounters.find(x => x.id === encounterId);
        if (!p || !e) throw new Error('Không tìm thấy hồ sơ này.'); setPatient(p); setEncounter(e);
      } catch (e) { if ((e as Error).name !== 'AbortError') setError((e as Error).message); }
    }
    void load(); return () => controller.abort();
  }, [encounterId]);
  return <div className="mp-document-page"><header className="mp-document-toolbar mp-no-print"><Link href={patient ? `/patient?patient=${patient.id}` : '/patient'}><ArrowLeft size={18} />Quay lại hồ sơ</Link><Button disabled={!encounter} onClick={() => window.print()}><Printer />In / Lưu PDF</Button></header><ErrorBox message={error} />{!encounter && !error && <Busy />}{patient && encounter && <article className="mp-document"><div className="mp-document-header"><div className="mp-document-brand"><HeartPulse />MediPass</div><span>HỒ SƠ LẦN KHÁM · GIẢ LẬP</span></div><h1>{encounter.reason}</h1><p className="mp-muted">Ngày khám {formatDate(encounter.visit_date)} · {encounter.clinician.facility}</p><section className="mp-document-patient"><strong>{patient.display_name}</strong><p>{patient.medical_record_number} · Ngày sinh {formatDate(patient.birth_date)} · Nhóm máu {patient.blood_type || 'chưa rõ'}</p><p><b>Dị ứng hiện có trong hồ sơ:</b> {patient.allergies.map(a => `${a.substance} (${a.reaction})`).join('; ') || 'Chưa ghi nhận'}</p><p><b>Bệnh nền / tiền sử chung:</b> {patient.conditions.map(c => c.name).join('; ') || 'Chưa ghi nhận'}</p><small>Thông tin chung cập nhật đến {formatDate(patient.updated_at)}.</small></section><EncounterDetail encounter={encounter} /><footer className="mp-document-footer">Tài liệu mô phỏng · Không sử dụng đơn thuốc giả lập để điều trị. Hồ sơ lần khám cập nhật {formatDate(encounter.updated_at)}.</footer></article>}</div>;
}
