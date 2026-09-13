'use client';

import { useState, useSyncExternalStore } from 'react';
import { ArrowUpRight, FlaskConical, HeartPulse, ShieldCheck, Stethoscope } from 'lucide-react';
import Link from '@/components/app-link';
import MediPassBrand from '@/components/medipass-brand';
import WoundVisitWorkflow from '@/components/wound-visit-workflow';
import WoundAnalysisResults from '@/components/wound-analysis-results';
import WoundClinicalHistory from '@/components/wound-clinical-history';
import { Switch } from '@/components/ui/switch';
import { MOCK_WOUND_PATIENTS, PATIENT_MODE_PROFILE } from '@/lib/wound-patients';

const subscribe = () => () => {};
export default function WoundAnalyzer() {
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(PATIENT_MODE_PROFILE.patient_id);
  const [busy, setBusy] = useState(false);
  const patient = developerMode ? MOCK_WOUND_PATIENTS.find(p => p.patient_id === selectedPatient) ?? PATIENT_MODE_PROFILE : PATIENT_MODE_PROFILE;

  return <main className="wound-theme min-h-screen bg-slate-50 text-[#0F172A] transition-colors dark:bg-slate-950 dark:text-slate-100" data-testid="wound-analyzer" data-ready={ready} data-mode={developerMode ? 'developer' : 'patient'}>
    <header className="border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8" aria-label="Điều hướng Wound Lab">
        <Link href="/" className="inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600"><MediPassBrand /></Link>
        <div className="flex flex-wrap gap-4 text-sm"><Link href="/patient" className="inline-flex min-h-11 items-center gap-2 text-slate-600 hover:text-blue-600 dark:text-slate-300"><Stethoscope className="size-4" />Hộ chiếu y tế</Link><Link href="/wounds/history" className="inline-flex min-h-11 items-center gap-2 text-slate-600 hover:text-blue-600 dark:text-slate-300">Lịch sử & ghi nhận<ArrowUpRight className="size-4" /></Link></div>
      </nav>
    </header>
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-8 sm:px-8 sm:pt-10">
      <section className="mb-7 grid items-end gap-6 lg:grid-cols-[1fr_auto]" data-annotate="wound-analyzer-intro" data-annotation-label="Theo dõi vết thương và hồ sơ lâm sàng">
        <div><p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-blue-600 dark:text-blue-300"><HeartPulse className="size-4" />WOUND LAB · PRECISION WOUND CARE</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Mỗi lần chụp, hiểu thêm tiến triển.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">Theo dõi vết thương qua thời gian, kết hợp hình ảnh với đường huyết, bệnh nền và lịch sử chăm sóc của bạn.</p></div>
        <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3 dark:border-blue-950 dark:bg-slate-900"><ShieldCheck className="size-5 text-blue-600 dark:text-blue-300" /><div><p className="text-sm font-semibold">Lưu xuyên suốt đợt chăm sóc</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tải lại · nối lần chụp · chủ động xóa</p></div></div>
      </section>

      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div><p className="flex items-center gap-2 font-semibold">{developerMode && <FlaskConical className="size-4 text-blue-600" />}{developerMode ? 'Developer Mode' : 'Patient Mode'}</p><p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400">{developerMode ? 'Hồ sơ mẫu · chọn từng lần chụp để xem pipeline' : 'Tài khoản bệnh nhân mô phỏng · hồ sơ cố định'}</p></div>
          <div className="flex min-h-11 items-center gap-3 text-sm"><span>Patient</span><Switch checked={developerMode} disabled={!ready || busy} onCheckedChange={setDeveloperMode} aria-label="Developer Mode" /><span>Developer</span></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-5 px-5 py-5">
          <div className="flex min-w-0 items-center gap-3"><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#0F172A] text-lg font-semibold text-white">{patient.display_name.split(' ').map(word => word[0]).slice(0, 2).join('')}</div><div><h2 className="font-semibold">{patient.display_name}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{patient.age} tuổi · nhóm máu {patient.blood_type} · {patient.patient_id}</p></div></div>
          {developerMode && <label className="min-w-0 text-xs font-medium text-slate-500 dark:text-slate-400">Chọn hồ sơ nghiên cứu<select aria-label="Chọn bệnh nhân giả lập" disabled={busy} value={selectedPatient} onChange={event => setSelectedPatient(event.target.value)} className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">{MOCK_WOUND_PATIENTS.map(profile => <option key={profile.patient_id} value={profile.patient_id}>{profile.display_name} · {profile.patient_id}</option>)}</select></label>}
          <div className="flex flex-wrap gap-2 text-xs font-medium"><span className="rounded-full bg-blue-50 px-3 py-2 text-blue-700 dark:bg-blue-950 dark:text-blue-200">HbA1c {patient.hba1c_level}%</span><span className={'rounded-full px-3 py-2 ' + (patient.has_diabetes_type_2 ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>{patient.has_diabetes_type_2 ? 'Đái tháo đường típ 2' : 'Không ghi nhận đái tháo đường típ 2'}</span></div>
        </div>
      </section>

      {ready && <WoundVisitWorkflow key={patient.patient_id} patient={patient} developerMode={developerMode} onBusyChange={setBusy}
        renderBrief={(brief, context) => <WoundAnalysisResults brief={brief} patient={context.lockedPatient} developerMode={developerMode} selectedDay={context.visit?.day} selectedImageUrl={context.imageUrl} pipelineVisuals={brief.pipeline_visuals} />} />}

      <div className="mt-8"><WoundClinicalHistory patient={patient} /></div>
      <p className="mt-6 text-xs leading-6 text-slate-500 dark:text-slate-400">MediPass Wound Lab · Hồ sơ lâm sàng mẫu được lưu riêng với các ảnh bạn tải lên. Kết quả AI là ước tính nghiên cứu từ mô hình học ảnh giả lập, cần nhân viên y tế xem xét cùng thăm khám trực tiếp.</p>
    </div>
  </main>;
}
