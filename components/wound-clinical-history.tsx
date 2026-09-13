'use client';

import type { ReactNode } from 'react';
import { Activity, Bandage, CalendarDays, ChevronDown, ClipboardList, Stethoscope } from 'lucide-react';
import type { WoundClinicalVisit, WoundMeasurementFlag, WoundPatient } from '@/lib/wound-patients';

const measurementFlags: Record<WoundMeasurementFlag, { label: string; className: string }> = {
  normal: { label: 'Trong khoảng', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  high: { label: 'Cao', className: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  low: { label: 'Thấp', className: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  recorded: { label: 'Đã ghi nhận', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};
const summaryTones: Record<WoundClinicalVisit['summary_tone'], string> = {
  routine: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  improving: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  review: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
};

function dateLabel(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function ClinicalGroup({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
    <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"><span className="text-[#2563EB] dark:text-blue-400">{icon}</span>{title}</h4>
    {children}
  </section>;
}

function RecordField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800 dark:text-slate-200">{children}</dd></div>;
}

/** All source fields are shown when expanded; no clinical text is clipped or omitted. */
export function WoundClinicalHistory({ patient }: { patient: WoundPatient }) {
  return <section className="min-w-0" aria-labelledby="wound-clinical-history-heading" data-testid="wound-clinical-history" data-annotate="wound-clinical-history" data-annotation-label="Lịch sử khám và hồ sơ nền vết thương">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB] dark:text-blue-400">Hồ sơ nền · Clinical history</p><h2 id="wound-clinical-history-heading" className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Lịch sử khám của {patient.display_name}</h2></div>
      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{patient.clinical_visits.length} lần khám giả lập</span>
    </div>
    <p className="mb-4 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">Mở từng lần khám để xem đầy đủ xét nghiệm, can thiệp, thuốc và kế hoạch đã ghi. Đây là lịch sử mẫu có sẵn; ảnh theo dõi bạn lưu được hiển thị riêng trong dòng thời gian. Đơn và kế hoạch dưới đây không phải chỉ định cho người dùng.</p>
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"><p className="font-medium">Ghi nhận nền ngày {dateLabel(patient.baseline_recorded_at)}</p><p>{patient.vascular_notes}</p><p>{patient.neuropathy_notes}</p></div>
    <div className="space-y-3">
      {[...patient.clinical_visits].reverse().map(visit => <details key={visit.visit_id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:open:border-blue-800" data-encounter-id={visit.visit_id} data-annotate={`wound-history-${visit.visit_id}`} data-annotation-label={`Lần khám vết thương ${dateLabel(visit.date)}`}>
        <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 p-4 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB] dark:hover:bg-slate-800/70 sm:p-5 [&::-webkit-details-marker]:hidden">
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB] dark:bg-blue-950/50 dark:text-blue-300 sm:flex"><CalendarDays className="size-5" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-900 dark:text-slate-100"><time dateTime={visit.date} className="font-semibold tabular-nums">{dateLabel(visit.date)}</time><span aria-hidden="true" className="text-slate-400">·</span><span>{visit.encounter_type}</span><span aria-hidden="true" className="hidden text-slate-400 sm:inline">·</span><span className="basis-full text-slate-500 dark:text-slate-400 sm:basis-auto">{visit.clinician.name}</span></div>
            <span className={`mt-2 inline-flex max-w-full rounded-lg px-2.5 py-1 text-xs font-medium leading-5 ${summaryTones[visit.summary_tone]}`}>{visit.summary}</span>
          </div>
          <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
        </summary>
        <div className="border-t border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/50 sm:p-5">
          <p className="mb-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{visit.clinician.name} · {visit.clinician.specialty}<br />{visit.record_source}<br /><span className="break-all">Mã lần khám: {visit.visit_id}</span></p>
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
            <ClinicalGroup title="Sinh hiệu & Xét nghiệm" icon={<Activity className="size-4" aria-hidden="true" />}>
              <dl className="space-y-3">
                {visit.measurements.map(measurement => <div key={measurement.code} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-2"><dt className="text-sm font-medium text-slate-700 dark:text-slate-200">{measurement.label} <span className="text-xs text-slate-500 dark:text-slate-400">({measurement.code})</span></dt><dd className="flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100"><span>{measurement.value} <span className="text-xs font-normal">{measurement.unit}</span></span><span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${measurementFlags[measurement.flag].className}`}>{measurementFlags[measurement.flag].label}</span></dd></div>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Tham chiếu trên phiếu: {measurement.reference_range}<br />Đo ngày <time dateTime={measurement.recorded_at}>{dateLabel(measurement.recorded_at)}</time>{measurement.recorded_at !== visit.date ? ' · kết quả nền được mang sang lần khám này' : ''}</p>
                </div>)}
              </dl>
            </ClinicalGroup>
            <ClinicalGroup title="Tình trạng & Can thiệp vết thương" icon={<Stethoscope className="size-4" aria-hidden="true" />}>
              <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
                <RecordField label="Vị trí">{visit.wound.site}</RecordField>
                <RecordField label="Dài × Rộng × Sâu">{visit.wound.length_cm} × {visit.wound.width_cm} × {visit.wound.depth_cm} cm</RecordField>
                <RecordField label="Diện tích được ghi">{visit.wound.recorded_area_cm2} cm²</RecordField>
                <RecordField label="Bờ vết thương">{visit.wound.edge_state}</RecordField>
                <RecordField label="Mức tiết dịch">{visit.wound.exudate}</RecordField>
                <RecordField label="Da xung quanh">{visit.wound.surrounding_skin}</RecordField>
                <RecordField label="Điểm đau đã ghi">{visit.wound.pain_score}/10</RecordField>
              </dl>
              <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 dark:bg-slate-800/60">
                <div className="flex items-start justify-between gap-3"><dt className="text-emerald-700 dark:text-emerald-300">Mô hạt (Granulation tissue - mô lành mới hình thành)</dt><dd className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">{visit.wound.tissue_percentages.granulation}%</dd></div>
                <div className="flex items-start justify-between gap-3"><dt className="text-amber-800 dark:text-amber-300">Mô vàng / Vữa mô (Slough - dịch nhầy và tế bào chết tích tụ)</dt><dd className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">{visit.wound.tissue_percentages.slough}%</dd></div>
                <div className="flex items-start justify-between gap-3"><dt className="text-rose-700 dark:text-rose-300">Mô hoại tử / Mày khô (Necrosis / Eschar - mô chết cần theo dõi sát)</dt><dd className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">{visit.wound.tissue_percentages.necrotic}%</dd></div>
              </dl>
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{visit.wound.measurement_note}</p>
              <h5 className="mb-2 mt-4 text-xs font-semibold text-slate-700 dark:text-slate-200">Thủ thuật đã ghi nhận</h5>
              <ul className="space-y-2 pl-4 text-sm leading-6 text-slate-700 marker:text-blue-500 dark:text-slate-300 [&>li]:list-disc">{visit.wound.procedures.map((procedure, index) => <li key={index}>{procedure}</li>)}</ul>
            </ClinicalGroup>
            <ClinicalGroup title="Đơn thuốc & Băng gạc" icon={<Bandage className="size-4" aria-hidden="true" />}>
              <div className="space-y-3">
                {visit.medications.length === 0 && <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">Phiếu mẫu ghi không có thuốc dùng đều hoặc thuốc mới được kê trong lần khám này.</p>}
                {visit.medications.map((medication, index) => <div key={`${medication.name}-${index}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{medication.name} · {medication.strength}</h5>
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2"><RecordField label="Liều mỗi lần">{medication.dose}</RecordField><RecordField label="Đường dùng">{medication.route}</RecordField><RecordField label="Lịch dùng chính xác">{medication.schedule}</RecordField><RecordField label="Trạng thái">{medication.status}</RecordField></dl>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{medication.note}</p>
                </div>)}
                {visit.dressings.map((dressing, index) => <div key={`${dressing.name}-${index}`} className="rounded-xl bg-blue-50/70 p-3 dark:bg-blue-950/30"><h5 className="text-sm font-semibold text-[#2563EB] dark:text-blue-300">Băng gạc · {dressing.name}</h5><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{dressing.application}</p><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{dressing.schedule}</p></div>)}
              </div>
            </ClinicalGroup>
            <ClinicalGroup title="Chăm sóc & Tái khám" icon={<ClipboardList className="size-4" aria-hidden="true" />}>
              <dl className="space-y-4"><RecordField label="Giảm tải / Offloading">{visit.care.offloading}</RecordField><RecordField label="Quy trình thay băng đã ghi">{visit.care.dressing_protocol}</RecordField><RecordField label="Theo dõi trong phiếu chăm sóc">{visit.care.monitoring}</RecordField><RecordField label="Lịch hẹn tiếp theo"><time dateTime={visit.care.follow_up_date} className="font-semibold text-[#2563EB] dark:text-blue-300">{dateLabel(visit.care.follow_up_date)}</time><br />{visit.care.follow_up_location}</RecordField></dl>
              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">{visit.care.additional_notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
            </ClinicalGroup>
          </div>
        </div>
      </details>)}
    </div>
  </section>;
}

export default WoundClinicalHistory;
