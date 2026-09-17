'use client';

import { useState, type ReactNode } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, CircleHelp, FileText, HeartPulse, Minus, ShieldAlert, Stethoscope } from 'lucide-react';
import type { ClinicalBrief, PipelineVisuals, WoundVisit } from '@/lib/wound-api';
import type { WoundPatient } from '@/lib/wound-patients';
import {
  measuredNumber, patientEducation, reconciledWoundVisit, selectedPipelineVisuals, selectedWoundVisit,
  trajectoryPresentation, woundNumber, woundRasterSource, woundRecord, woundText,
  type HealingStatus, type WoundLanguage,
} from '@/lib/wound-presentation';

const card = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6';
const muted = 'text-slate-600 dark:text-slate-300';
const prose = `whitespace-pre-line break-words text-sm leading-7 ${muted}`;
const tissueDefinitions = [
  { key: 'granulation', color: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-300',
    vi: 'Granulation tissue', en: 'Granulation tissue', note: 'Granulation tissue — newly formed repair tissue', englishNote: 'Granulation tissue — newly formed repair tissue', label: 'Red' },
  { key: 'slough', color: 'bg-amber-500', textColor: 'text-amber-700 dark:text-amber-300',
    vi: 'Slough', en: 'Slough', note: 'Slough — accumulated material and dead cells', englishNote: 'Slough — accumulated material and dead cells', label: 'Yellow' },
  { key: 'necrotic', color: 'bg-rose-500', textColor: 'text-rose-700 dark:text-rose-300',
    vi: 'Necrosis / Eschar', en: 'Necrosis / Eschar', note: 'Necrosis / Eschar — dark material that needs close clinical review', englishNote: 'Necrosis / Eschar — dark material that needs close clinical review', label: 'Black' },
] as const;

const statuses: Record<HealingStatus, { vi: string; en: string; style: string; icon: typeof Activity }> = {
  improving: { vi: 'Improving', en: 'Improving', style: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200', icon: ArrowDownRight },
  stagnant: { vi: 'Stagnant', en: 'Stagnant', style: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200', icon: Minus },
  deteriorating: { vi: 'Deteriorating', en: 'Deteriorating', style: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200', icon: ArrowUpRight },
  insufficient_data: { vi: 'Insufficient comparable data', en: 'Insufficient comparable data', style: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200', icon: CircleHelp },
};

function Copy({ value, fallback }: { value: unknown; fallback?: string }) {
  const text = woundText(value, fallback);
  return text ? <p className={prose}>{text}</p> : null;
}

export default function WoundAnalysisResults({ brief, patient, developerMode, selectedDay, selectedImageUrl, pipelineVisuals }: {
  brief: ClinicalBrief;
  patient: WoundPatient;
  developerMode: boolean;
  selectedDay?: number;
  selectedImageUrl?: string;
  pipelineVisuals?: PipelineVisuals;
}) {
  const language: WoundLanguage = 'en';
  const visuals = selectedPipelineVisuals(brief, selectedDay, pipelineVisuals);
  const visit = reconciledWoundVisit(selectedWoundVisit(brief, selectedDay), visuals);
  const education = patientEducation(brief, language);
  const trajectory = trajectoryPresentation(brief);
  return <div data-testid={developerMode ? 'developer-outcome' : 'patient-brief'} className="min-w-0 space-y-5 text-slate-900 dark:text-slate-100">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-blue-600 dark:text-blue-300">WOUND IMAGE + CLINICAL HISTORY</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Understanding your progress</h2>
        <p className={`mt-2 text-sm ${muted}`}>{patient.display_name} · Day {measuredNumber(visit?.day ?? selectedDay)} · {brief.objective_measurements.visits.length} captures in this analysis</p>
      </div>
      <span className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">English</span>
    </header>

    {trajectory.highRiskNonHealing && <section role="alert" data-testid="high-risk-non-healing-alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-5 dark:border-rose-800 dark:bg-rose-950/30 sm:p-6">
      <div className="flex items-start gap-3"><ShieldAlert aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-rose-600 dark:text-rose-300" /><div>
        <h3 className="font-semibold text-rose-900 dark:text-rose-200">High-risk non-healing trajectory alert</h3>
        <p className={`mt-2 text-sm leading-7 ${muted}`}>Limited measured change over {measuredNumber(trajectory.nonHealing.elapsed_days ?? trajectory.highRiskFlag?.elapsed_days)} days, alongside {patient.has_diabetes_type_2 ? 'recorded type 2 diabetes and ' : ''}HbA1c {measuredNumber(patient.hba1c_level)}%. Your care team should review the progress and existing care plan.</p>
        <div className="mt-2"><Copy value={education.when_to_seek_care} /></div>
      </div></div>
    </section>}

    <BaselineContext patient={patient} />
    {brief.objective_measurements.visits.length >= 2
      ? <LongitudinalTracking brief={brief} language={language} />
      : <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-900 dark:bg-blue-950/30"><Activity aria-hidden="true" className="mt-1 size-5 shrink-0 text-blue-600 dark:text-blue-300" /><p className={`text-sm leading-7 ${muted}`}>{visit?.analysis_status === 'pending_model' ? 'The first capture and baseline have been saved. Image analysis is waiting for the model; measurements and healing trends are unavailable.' : 'The first image has been analyzed with your baseline history and establishes a tracking reference. Add a later capture to compare area and tissue composition; one image cannot establish a healing rate.'}</p></div>}

    <CurrentMeasurements visit={visit} language={language} measurementNote={education.measurement_note} />
    <PatientEducation brief={brief} language={language} />
    {developerMode && <>
      <VisualPipeline brief={brief} patient={patient} selectedDay={selectedDay} selectedImageUrl={selectedImageUrl} pipelineVisuals={pipelineVisuals} language={language} />
      <DeveloperDetails brief={brief} visit={visit} />
    </>}
  </div>;
}

function BaselineContext({ patient }: { patient: WoundPatient }) {
  const profile = woundRecord(patient);
  const recorded = (value: unknown) => typeof value === 'boolean' ? value ? 'Recorded' : 'Not recorded' : woundText(value, 'Not recorded');
  const vascular: Record<string, string> = { normal: 'Normal perfusion recorded', impaired: 'Impaired perfusion recorded', unknown: 'Not assessed' };
  const neuropathy: Record<string, string> = { present: 'Recorded', absent: 'Not recorded', unknown: 'Not assessed' };
  const entries = [
    ['Type 2 diabetes', recorded(patient.has_diabetes_type_2)],
    ['HbA1c', `${measuredNumber(patient.hba1c_level)}%`],
    ['Fasting glucose · FPG', woundNumber(profile.fpg_mg_dl) !== undefined ? `${measuredNumber(profile.fpg_mg_dl)} mg/dL` : 'Not recorded'],
    ['Peripheral vascular status', vascular[woundText(profile.peripheral_vascular_status)] ?? recorded(profile.peripheral_arterial_disease)],
    ['Peripheral neuropathy', neuropathy[woundText(profile.neuropathy_status)] ?? recorded(profile.peripheral_neuropathy ?? profile.neuropathy)],
    ['Hypertension', recorded(patient.hypertension)],
  ];
  return <section data-testid="fused-baseline-context" className={card}>
    <div className="flex items-center gap-2"><HeartPulse aria-hidden="true" className="size-5 text-blue-600 dark:text-blue-300" /><h3 className="font-semibold">Baseline used in this analysis</h3></div>
    <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{entries.map(([label, value]) => <div key={label} className="min-w-0"><dt className={`text-xs ${muted}`}>{label}</dt><dd className="mt-1 break-words text-sm font-semibold leading-6">{value}</dd></div>)}</dl>
    {(woundText(profile.vascular_notes) || woundText(profile.neuropathy_notes)) && <div className="mt-4 space-y-2"><Copy value={profile.vascular_notes} /><Copy value={profile.neuropathy_notes} /></div>}
    <p className={`mt-4 border-t border-slate-100 pt-3 text-xs leading-6 dark:border-slate-800 ${muted}`}>The baseline is fixed within this tracking session so captures are evaluated against the same history.</p>
  </section>;
}

function LongitudinalTracking({ brief, language }: { brief: ClinicalBrief; language: WoundLanguage }) {
  const info = trajectoryPresentation(brief);
  const { comparison } = info;
  const badge = statuses[info.status];
  const Icon = badge.icon;
  const deltaUnit = info.areaAvailable ? 'cm²' : 'pixels';
  const areaDelta = info.areaAvailable ? comparison.area_change_cm2 : info.pixelsAvailable ? comparison.area_change_pixels : undefined;
  return <section data-testid="longitudinal-tracking" className={card}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Longitudinal Tracking</h3><p className={`mt-1 text-xs leading-6 ${muted}`}>{info.comparable ? `Day ${measuredNumber(comparison.from_day)} → day ${measuredNumber(comparison.to_day)} · ${measuredNumber(comparison.elapsed_days)} days` : 'The latest adjacent captures do not yet provide comparable measurements.'}</p></div>
      <span data-testid="healing-status" className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${badge.style}`}><Icon aria-hidden="true" className="size-4 shrink-0" />{badge[language]}</span>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1.5fr]">
      <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70"><p className={`text-xs font-medium ${muted}`}>Area delta · Δ</p><p className="mt-2 break-all text-2xl font-semibold tabular-nums">{measuredNumber(areaDelta, true)} <span className="text-sm font-medium">{areaDelta === undefined ? '' : deltaUnit}</span></p>
        {woundNumber(comparison.area_trend_change_percent) !== undefined && (info.areaAvailable || info.pixelTrendAvailable) && <p className={`mt-2 text-sm tabular-nums ${muted}`}>{measuredNumber(comparison.area_trend_change_percent, true)}% from the previous visit</p>}
        {info.areaAvailable && info.pixelsAvailable && <p className={`mt-2 break-words text-xs leading-6 ${muted}`}>Δ mask: {measuredNumber(comparison.area_change_pixels, true)} pixels</p>}
        <p className={`mt-3 text-xs leading-6 ${muted}`}>{info.areaAvailable ? 'Projected 2D area from supplied image scale; not a clinically verified measurement.' : 'Pixel counts depend on camera distance and angle. No cm² conversion is made without image scale.'}</p>
      </div>
      <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"><h4 className={`text-xs font-medium ${muted}`}>Tissue composition deltas</h4><dl className="mt-3 space-y-3">{tissueDefinitions.map(tissue => <div key={tissue.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm"><dt className="flex items-center gap-2"><span aria-hidden="true" className={`size-2 rounded-full ${tissue.color}`} />{tissue[language]}</dt><dd className="break-all font-semibold tabular-nums">{measuredNumber(info.tissueDeltas[tissue.key], true)} <span className={`text-xs font-normal ${muted}`}>pp</span></dd></div>)}</dl>
        <div className={`mt-3 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800 ${muted}`}><span>Unclassified fraction</span><span className="break-all tabular-nums">{measuredNumber(info.tissueAvailable ? comparison.unclassified_change_pp : undefined, true)} pp</span></div>
      </div>
    </div>
    <p className={`mt-4 text-xs leading-6 ${muted}`}>The progress badge describes research rules applied to comparable measurements; it does not confirm healing. Percentage points (pp) are the difference between two percentages, not a relative percent change.</p>
    {info.pixelsAvailable && !info.pixelTrendAvailable && !info.areaAvailable && <p className="mt-2 text-xs leading-6 text-amber-800 dark:text-amber-200">Capture consistency is unconfirmed: raw pixel deltas remain visible but cannot establish a size trend.</p>}
  </section>;
}

function CurrentMeasurements({ visit, language, measurementNote }: { visit?: WoundVisit; language: WoundLanguage; measurementNote: unknown }) {
  const quality = woundRecord(visit?.quality);
  const metricsAvailable = !!visit && quality.usable_for_demo !== false && (visit.measurement_status === undefined || visit.measurement_status === 'available');
  const usable = metricsAvailable && !!visit?.tissue_percentages;
  const area = metricsAvailable ? woundNumber(visit.area_cm2) : undefined;
  const pixels = metricsAvailable ? woundNumber(visit.wound_area_pixels) : undefined;
  return <section data-testid="current-wound-measurements" className={card}>
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-lg font-semibold">Selected capture measurements</h3><span className={`text-xs ${muted}`}>Day {measuredNumber(visit?.day)}</span></div>
    {!usable && <output className="mt-4 block rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Reliable tissue measurements are unavailable for this capture. The baseline is still considered; missing measurements do not mean zero risk.</output>}
    <div className="mt-4 grid gap-3 sm:grid-cols-3">{tissueDefinitions.map(tissue => {
      const amount = usable ? visit.tissue_percentages?.[tissue.key] : undefined;
      return <article key={tissue.key} className="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex items-center gap-2"><span aria-hidden="true" className={`size-2.5 rounded-full ${tissue.color}`} /><h4 className="text-sm font-semibold">{tissue[language]}</h4></div>
        <p className={`my-3 break-all text-3xl font-semibold tabular-nums ${tissue.textColor}`}>{amount === undefined ? 'Not available' : `${amount.toFixed(1)}%`}</p>
        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${tissue.color}`} style={{ width: `${Math.min(100, Math.max(0, amount ?? 0))}%` }} /></div>
        <p className={`mt-3 text-xs leading-6 ${muted}`}>{tissue.englishNote}</p>
      </article>;
    })}</div>
    <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70 sm:grid-cols-3">
      <Metric label="Projected area" value={area === undefined ? !usable ? 'Not available' : 'No image scale' : `${measuredNumber(area)} cm²`} />
      <Metric label="U-Net wound area" value={pixels === undefined ? 'Not available' : `${measuredNumber(pixels)} pixels`} />
      <Metric label="Unclassified wound fraction" value={metricsAvailable && woundNumber(visit.unclassified_percentage) !== undefined ? `${measuredNumber(visit.unclassified_percentage)}%` : 'Not available'} />
    </dl>
    <div className="mt-4"><Copy value={measurementNote} fallback="Color labels are image estimates and require direct clinical tissue assessment." /></div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className={`text-xs ${muted}`}>{label}</dt><dd className="mt-1 break-words text-sm font-semibold leading-6 tabular-nums">{value}</dd></div>;
}

function EducationStep({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return <section className={card}><div className="mb-4 flex items-center gap-3"><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white">{number}</span><h3 className="font-semibold">{title}</h3></div><div className="space-y-3">{children}</div></section>;
}

function PatientEducation({ brief, language }: { brief: ClinicalBrief; language: WoundLanguage }) {
  const content = patientEducation(brief, language);
  const actions = Array.isArray(content.what_to_do) ? content.what_to_do : [];
  const present = !!woundText(content.simple_explanation);
  const missing = 'The service has not supplied this explanation yet.';
  return <section data-testid="patient-education" lang={language} className="space-y-4" aria-label="Four-step explanation">
    {!present && <p className={`rounded-xl bg-slate-100 p-4 text-sm leading-6 dark:bg-slate-800 ${muted}`}>English patient explanations are unavailable in this response version. The original narrative is retained below.</p>}
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <EducationStep number={1} title="What does this result mean?"><Copy value={content.simple_explanation} fallback={!present ? brief.multimodal_context_analysis : missing} />{woundText(content.baseline_context) && <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40"><p className="mb-2 text-xs font-semibold text-blue-700 dark:text-blue-300">Your recorded baseline</p><Copy value={content.baseline_context} /></div>}</EducationStep>
      <EducationStep number={2} title="Why this matters · The biology"><Copy value={content.why_this_matters} fallback={missing} /></EducationStep>
      <EducationStep number={3} title="What could happen?"><Copy value={content.possible_consequences} fallback={missing} /><Copy value={content.rule_note} /></EducationStep>
      <EducationStep number={4} title="What can you do next?">
        {actions.length ? <ul className="space-y-3">{actions.map((action, index) => {
          const item = woundRecord(action);
          const text = typeof action === 'string' ? action : woundText(item.text);
          return text ? <li key={`${woundText(item.action_id)}-${index}`} className={`flex items-start gap-2 text-sm leading-7 ${muted}`}><span aria-hidden="true" className="mt-3 size-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" /><span className="min-w-0 whitespace-pre-line break-words">{text}</span></li> : null;
        })}</ul> : <Copy value={!present ? brief.system_recommendation : undefined} fallback={missing} />}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"><h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200"><Stethoscope aria-hidden="true" className="size-4 shrink-0" />When to seek care</h4><Copy value={content.when_to_seek_care} fallback={missing} /></div>
      </EducationStep>
    </div>
    <div data-testid="patient-safety-note" className="flex items-start gap-3 rounded-xl bg-slate-100 p-4 dark:bg-slate-800"><ShieldAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-500 dark:text-slate-400" /><Copy value={content.safety_note} fallback="Research models are not clinically validated. Do not self-diagnose or change treatment from these results; clinical assessment is needed." /></div>
    <EvidenceSources brief={brief} />
  </section>;
}

function EvidenceSources({ brief }: { brief: ClinicalBrief }) {
  const assessment = woundRecord(brief.trajectory_risk_assessment);
  const provenance = woundRecord(assessment.rule_provenance);
  const evidence = woundRecord(provenance.evidence);
  const explanation = woundRecord(brief.patient_explanation ?? assessment.patient_explanation);
  const ids = Array.isArray(explanation.evidence_ids) ? explanation.evidence_ids.filter((id): id is string => typeof id === 'string') : [];
  const sources = ids.map(id => ({ id, data: woundRecord(evidence[id]) })).filter(source => typeof source.data.url === 'string' && source.data.url.startsWith('https://'));
  if (!sources.length) return null;
  return <details className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm dark:border-slate-800 dark:bg-slate-900"><summary className="cursor-pointer font-medium">Explanation sources</summary><ul className="mt-4 space-y-3">{sources.map(source => <li key={source.id} className="min-w-0"><a href={String(source.data.url)} target="_blank" rel="noopener noreferrer" className="break-words text-blue-700 underline underline-offset-4 dark:text-blue-300">{woundText(source.data.section, source.id.replaceAll('_', ' '))}</a>{woundText(source.data.scope) && <p className={`mt-1 text-xs leading-6 ${muted}`}>{String(source.data.scope)}</p>}</li>)}</ul></details>;
}

function PipelineImage({ src, backgroundSrc, label, fallback }: { src?: string; backgroundSrc?: string; label: string; fallback: string }) {
  const [failedSource, setFailedSource] = useState<string>();
  const [failedBackground, setFailedBackground] = useState<string>();
  // Private local captures and bounded raster data must not use the public image optimizer.
  return src && src !== failedSource ? backgroundSrc && backgroundSrc !== failedBackground
    ? <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        {/* eslint-disable-next-line next/no-img-element */}
        <img src={backgroundSrc} alt="" aria-hidden="true" onError={() => setFailedBackground(backgroundSrc)} className="absolute inset-0 size-full object-contain" />
        {/* eslint-disable-next-line next/no-img-element */}
        <img src={src} alt={label} onError={() => setFailedSource(src)} className="absolute inset-0 size-full object-contain" />
      </div>
    // eslint-disable-next-line next/no-img-element
    : <img src={src} alt={label} onError={() => setFailedSource(src)} className="aspect-square w-full rounded-xl bg-slate-100 object-contain dark:bg-slate-800" />
    : <div className={`flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm leading-7 dark:border-slate-700 dark:bg-slate-800/70 ${muted}`}>{fallback}</div>;
}

function VisualPipeline({ brief, patient, selectedDay, selectedImageUrl, pipelineVisuals, language }: {
  brief: ClinicalBrief; patient: WoundPatient; selectedDay?: number; selectedImageUrl?: string; pipelineVisuals?: PipelineVisuals; language: WoundLanguage;
}) {
  const visuals = selectedPipelineVisuals(brief, selectedDay, pipelineVisuals);
  const available = visuals.status === 'available';
  const fallback = visuals.status === 'quality_abstained'
    ? 'Segmentation was withheld because this image did not pass quality checks.'
    : 'Pipeline visuals are unavailable for this selected capture.';
  const originalSource = selectedImageUrl || woundRasterSource(visuals.original_image, visuals.original_mime_type);
  const panels = [
    { title: 'Input', label: 'Selected original capture', source: originalSource, note: 'Original image for the selected visit.' },
    { title: 'U-Net Boundary', label: 'Dominant wound region with boundary', source: available ? woundRasterSource(visuals.unet_segmentation_mask, 'image/png') : undefined, backgroundSource: originalSource, note: 'The cyan edge is overlaid on the original image to locate the dominant region after short-gap closing, noise removal, and hole filling. This single-wound post-processing improves readability but is not clinical validation.' },
    { title: 'Tissue Overlay', label: 'Tissue classification overlay', source: available ? woundRasterSource(visuals.tissue_analysis_overlay, 'image/png') : undefined, note: 'Model overlay: red = granulation; yellow = slough; gray = dark-tissue class. Percentages use mask pixels, including unclassified tissue.' },
  ];
  const education = patientEducation(brief, language);
  return <section data-testid="pipeline-visualization" aria-label="Pipeline Visualization" className="space-y-4">
    <div><p className="text-xs font-semibold tracking-widest text-blue-600 dark:text-blue-300">DEVELOPER MODE</p><h3 className="mt-2 text-xl font-semibold">Pipeline Visualization · Day {measuredNumber(selectedDay ?? brief.objective_measurements.visits.at(-1)?.day)}</h3></div>
    <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {panels.map((panel, index) => <article key={panel.title} className={`${card} p-4!`}><div className="mb-3 flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white dark:bg-blue-600">{index + 1}</span><h4 className="font-semibold">{panel.title}</h4></div><PipelineImage src={panel.source} backgroundSrc={panel.backgroundSource} label={panel.label} fallback={fallback} /><p className={`mt-3 text-xs leading-6 ${muted}`}>{panel.note}</p></article>)}
      <article className={`${card} border-blue-200! p-4! dark:border-blue-900!`}><div className="mb-3 flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-semibold text-white">4</span><h4 className="font-semibold">Clinical Brief</h4></div><div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40"><FileText aria-hidden="true" className="mb-3 size-6 text-blue-600 dark:text-blue-300" /><p className="break-words text-sm font-semibold">{patient.display_name}</p><p className={`mt-2 text-xs leading-6 ${muted}`}>HbA1c {measuredNumber(patient.hba1c_level)}% · Type 2 diabetes: {patient.has_diabetes_type_2 ? 'Recorded' : 'Not recorded'}</p></div><div className="mt-3"><Copy value={education.simple_explanation} fallback={brief.multimodal_context_analysis} /></div><details className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800"><summary className="cursor-pointer text-xs font-semibold">Full clinical context</summary><div className="mt-3 space-y-3"><Copy value={brief.clinician_context_analysis} fallback={brief.multimodal_context_analysis} /><Copy value={brief.clinician_recommendation} fallback={brief.system_recommendation} /></div></details></article>
    </div>
    <p className={`text-xs leading-6 ${muted}`}>Segmentation images are not feature-attribution maps. These research tissue estimates, risk scores and interpretations require professional review.</p>
    {woundText(visuals.reason) && <Copy value={visuals.reason} />}
  </section>;
}

function DeveloperDetails({ brief, visit }: { brief: ClinicalBrief; visit?: WoundVisit }) {
  const quality = woundRecord(visit?.quality);
  const provenance = woundRecord(brief.provenance);
  const assessment = woundRecord(brief.trajectory_risk_assessment);
  const limitations = Array.isArray(brief.limitations) ? brief.limitations.filter((item): item is string => typeof item === 'string') : [];
  const metadata = {
    patient_id: brief.patient_id,
    selected_visit: visit,
    research_review_priority: brief.research_review_priority,
    provenance: brief.provenance,
    uncertainty: brief.uncertainty,
    trajectory_risk_assessment: brief.trajectory_risk_assessment,
    rule_provenance: brief.rule_provenance,
    risk_alerts: brief.risk_alerts,
    limitations: brief.limitations,
  };
  return <details data-testid="clinical-brief" className={card}><summary className="cursor-pointer font-semibold">Clinical Brief · Quality, uncertainty & provenance</summary>
    <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Metric label="Per-image model score · 0–1" value={measuredNumber(visit?.risk_deterioration_score)} />
      <Metric label="Trajectory rule score · 0–1" value={measuredNumber(assessment.Deterioration_Risk_Score)} />
      <Metric label="Research uncertainty · 0–1" value={measuredNumber(assessment.Uncertainty_Score)} />
      <Metric label="Image quality" value={quality.usable_for_demo === true ? 'Basic quality checks passed' : quality.usable_for_demo === false ? 'Abstained' : 'Not assessed'} />
      <Metric label="Model version" value={woundText(provenance.model_version, '—')} />
      <Metric label="Clinical review status" value="Not clinically validated" />
    </dl>
    <p className={`mt-4 text-xs leading-6 ${muted}`}>Scores are uncalibrated, not infection probabilities or guarantees of recovery. Missing scores remain unevaluated, not zero.</p>
    {limitations.length > 0 && <ul className={`mt-4 list-disc space-y-2 pl-5 text-xs leading-6 ${muted}`}>{limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>}
    <details className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800"><summary className="cursor-pointer text-sm font-medium">Complete metadata · JSON</summary><pre className="mt-3 max-h-128 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-50 p-4 text-xs leading-6 dark:bg-slate-950">{JSON.stringify(metadata, null, 2)}</pre></details>
  </details>;
}
