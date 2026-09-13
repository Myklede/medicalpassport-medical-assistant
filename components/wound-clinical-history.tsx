'use client';

import type { ReactNode } from 'react';
import { Activity, Bandage, CalendarDays, ChevronDown, ClipboardList, Stethoscope } from 'lucide-react';
import type { WoundClinicalVisit, WoundMeasurementFlag, WoundPatient } from '@/lib/wound-patients';

const measurementFlags: Record<WoundMeasurementFlag, { label: string; className: string }> = {
  normal: { label: 'Within range', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  high: { label: 'High', className: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  low: { label: 'Low', className: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  recorded: { label: 'Recorded', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
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
  return <section className="min-w-0" aria-labelledby="wound-clinical-history-heading" data-testid="wound-clinical-history" data-annotate="wound-clinical-history" data-annotation-label="Wound visit history and baseline profile">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB] dark:text-blue-400">BASELINE · CLINICAL HISTORY</p><h2 id="wound-clinical-history-heading" className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Visit history for {patient.display_name}</h2></div>
      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{patient.clinical_visits.length} simulated visits</span>
    </div>
    <p className="mb-4 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">Open a visit to review its labs, procedures, medications, and documented care plan. This is preloaded sample history; your saved tracking images appear separately in the timeline. The prescriptions and plans below are not instructions for the user.</p>
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"><p className="font-medium">Baseline recorded on {dateLabel(patient.baseline_recorded_at)}</p><p>{patient.vascular_notes}</p><p>{patient.neuropathy_notes}</p></div>
    <div className="space-y-3">
      {[...patient.clinical_visits].reverse().map(visit => <details key={visit.visit_id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:open:border-blue-800" data-encounter-id={visit.visit_id} data-annotate={`wound-history-${visit.visit_id}`} data-annotation-label={`Wound visit ${dateLabel(visit.date)}`}>
        <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 p-4 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563EB] dark:hover:bg-slate-800/70 sm:p-5 [&::-webkit-details-marker]:hidden">
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB] dark:bg-blue-950/50 dark:text-blue-300 sm:flex"><CalendarDays className="size-5" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-900 dark:text-slate-100"><time dateTime={visit.date} className="font-semibold tabular-nums">{dateLabel(visit.date)}</time><span aria-hidden="true" className="text-slate-400">·</span><span>{visit.encounter_type}</span><span aria-hidden="true" className="hidden text-slate-400 sm:inline">·</span><span className="basis-full text-slate-500 dark:text-slate-400 sm:basis-auto">{visit.clinician.name}</span></div>
            <span className={`mt-2 inline-flex max-w-full rounded-lg px-2.5 py-1 text-xs font-medium leading-5 ${summaryTones[visit.summary_tone]}`}>{visit.summary}</span>
          </div>
          <ChevronDown className="size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
        </summary>
        <div className="border-t border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-950/50 sm:p-5">
          <p className="mb-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{visit.clinician.name} · {visit.clinician.specialty}<br />{visit.record_source}<br /><span className="break-all">Visit ID: {visit.visit_id}</span></p>
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
            <ClinicalGroup title="Vitals & laboratory results" icon={<Activity className="size-4" aria-hidden="true" />}>
              <dl className="space-y-3">
                {visit.measurements.map(measurement => <div key={measurement.code} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-2"><dt className="text-sm font-medium text-slate-700 dark:text-slate-200">{measurement.label} <span className="text-xs text-slate-500 dark:text-slate-400">({measurement.code})</span></dt><dd className="flex flex-wrap items-center gap-2 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100"><span>{measurement.value} <span className="text-xs font-normal">{measurement.unit}</span></span><span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${measurementFlags[measurement.flag].className}`}>{measurementFlags[measurement.flag].label}</span></dd></div>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Report reference: {measurement.reference_range}<br />Measured on <time dateTime={measurement.recorded_at}>{dateLabel(measurement.recorded_at)}</time>{measurement.recorded_at !== visit.date ? ' · baseline result carried into this visit' : ''}</p>
                </div>)}
              </dl>
            </ClinicalGroup>
            <ClinicalGroup title="Wound status & procedures" icon={<Stethoscope className="size-4" aria-hidden="true" />}>
              <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
                <RecordField label="Location">{visit.wound.site}</RecordField>
                <RecordField label="Length × width × depth">{visit.wound.length_cm} × {visit.wound.width_cm} × {visit.wound.depth_cm} cm</RecordField>
                <RecordField label="Recorded area">{visit.wound.recorded_area_cm2} cm²</RecordField>
                <RecordField label="Wound edge">{visit.wound.edge_state}</RecordField>
                <RecordField label="Exudate">{visit.wound.exudate}</RecordField>
                <RecordField label="Surrounding skin">{visit.wound.surrounding_skin}</RecordField>
                <RecordField label="Recorded pain score">{visit.wound.pain_score}/10</RecordField>
              </dl>
              <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 dark:bg-slate-800/60">
                <div className="flex items-start justify-between gap-3"><dt className="text-emerald-700 dark:text-emerald-300">Granulation tissue — newly formed repair tissue</dt><dd className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">{visit.wound.tissue_percentages.granulation}%</dd></div>
                <div className="flex items-start justify-between gap-3"><dt className="text-amber-800 dark:text-amber-300">Slough — accumulated material and dead cells</dt><dd className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">{visit.wound.tissue_percentages.slough}%</dd></div>
                <div className="flex items-start justify-between gap-3"><dt className="text-rose-700 dark:text-rose-300">Necrosis / eschar — dark material needing close clinical review</dt><dd className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">{visit.wound.tissue_percentages.necrotic}%</dd></div>
              </dl>
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{visit.wound.measurement_note}</p>
              <h5 className="mb-2 mt-4 text-xs font-semibold text-slate-700 dark:text-slate-200">Recorded procedures</h5>
              <ul className="space-y-2 pl-4 text-sm leading-6 text-slate-700 marker:text-blue-500 dark:text-slate-300 [&>li]:list-disc">{visit.wound.procedures.map((procedure, index) => <li key={index}>{procedure}</li>)}</ul>
            </ClinicalGroup>
            <ClinicalGroup title="Medications & dressings" icon={<Bandage className="size-4" aria-hidden="true" />}>
              <div className="space-y-3">
                {visit.medications.length === 0 && <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">The sample chart records no standing medication or newly prescribed medication at this visit.</p>}
                {visit.medications.map((medication, index) => <div key={`${medication.name}-${index}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{medication.name} · {medication.strength}</h5>
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2"><RecordField label="Dose">{medication.dose}</RecordField><RecordField label="Route">{medication.route}</RecordField><RecordField label="Schedule">{medication.schedule}</RecordField><RecordField label="Status">{medication.status}</RecordField></dl>
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{medication.note}</p>
                </div>)}
                {visit.dressings.map((dressing, index) => <div key={`${dressing.name}-${index}`} className="rounded-xl bg-blue-50/70 p-3 dark:bg-blue-950/30"><h5 className="text-sm font-semibold text-[#2563EB] dark:text-blue-300">Dressing · {dressing.name}</h5><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{dressing.application}</p><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{dressing.schedule}</p></div>)}
              </div>
            </ClinicalGroup>
            <ClinicalGroup title="Care & follow-up" icon={<ClipboardList className="size-4" aria-hidden="true" />}>
              <dl className="space-y-4"><RecordField label="Offloading">{visit.care.offloading}</RecordField><RecordField label="Recorded dressing protocol">{visit.care.dressing_protocol}</RecordField><RecordField label="Care-plan monitoring">{visit.care.monitoring}</RecordField><RecordField label="Next appointment"><time dateTime={visit.care.follow_up_date} className="font-semibold text-[#2563EB] dark:text-blue-300">{dateLabel(visit.care.follow_up_date)}</time><br />{visit.care.follow_up_location}</RecordField></dl>
              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">{visit.care.additional_notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
            </ClinicalGroup>
          </div>
        </div>
      </details>)}
    </div>
  </section>;
}

export default WoundClinicalHistory;
