'use client';
import { Activity, Building2, FileText, FlaskConical, Pill, Stethoscope } from 'lucide-react';
import type { Encounter } from '@/lib/portal-types';
import { interpretLab, labGuide, referenceLabel, glossaryForLab } from '@/lib/lab-interpretation';
import { formatDate, medicineLabels } from './portal-ui';

export function EncounterDetail({ encounter: e }: { encounter: Encounter }) {
  const vitals = [[e.blood_pressure, 'Blood pressure', 'mmHg'], [e.pulse, 'Pulse', 'beats/min'], [e.temperature, 'Temperature', '°C'], [e.weight, 'Weight', 'kg'], [e.oxygen_saturation, 'SpO₂ · blood oxygen', '%']].filter(([value]) => value);
  return <div className="mp-encounter-detail">
    <div className="mp-detail-grid">
      <section><h3><FileText />Reason & symptoms</h3><p>{e.reason}</p><p className="mp-muted mp-preserve">{e.symptoms || 'No symptoms recorded.'}</p></section>
      <section><h3><Stethoscope />Clinician assessment</h3><p className="mp-preserve">{e.plain_diagnosis || e.diagnosis || 'No assessment recorded.'}</p>{e.plain_diagnosis && e.diagnosis && <p className="mp-clinical-term mp-preserve">{e.diagnosis}</p>}</section>
    </div>
    {vitals.length > 0 && <div className="mp-vitals">{vitals.map(([value, label, unit]) => <div key={label}><span>{label}</span><strong>{value} <small>{unit}</small></strong></div>)}</div>}
    {e.labs.length > 0 && <section className="mp-detail-section"><h3><FlaskConical />Lab results <span className="mp-count">{e.labs.length}</span></h3><div className="mp-labs">{e.labs.map(lab => {
      const reading = interpretLab(lab);
      const guide = glossaryForLab(lab.name);
      const plainName = lab.plain_name || guide?.plain_name;
      const explanation = lab.explanation || guide?.explanation;
      const source = lab.source_url || (guide && !lab.explanation ? guide.source_url : '');
      return <article data-annotate={`visit-${e.id}-lab-${lab.id}`} data-annotation-label={`Lab result: ${lab.name}`} className={`mp-lab mp-lab-${reading.status}`} key={lab.id}>
        <div className="mp-lab-top"><div><h4>{plainName || lab.name}</h4>{plainName && <p className="mp-clinical-term">{lab.name}</p>}</div><div className="mp-lab-result"><strong>{lab.value}</strong> <span>{lab.unit}</span><span className={`mp-result-tag ${reading.status}`}>{reading.label}</span></div></div>
        <div className="mp-lab-reference"><span>Range reported by this lab: <b>{referenceLabel(lab)}</b></span>{reading.percent !== null && <div className="mp-range" aria-hidden="true"><i style={{ left: `${reading.percent}%` }} /></div>}</div>
        {lab.reference_text && (lab.reference_low !== null || lab.reference_high !== null) && <p className="mp-footnote mp-preserve">{lab.reference_text}</p>}
        <div className={`mp-lab-verdict ${reading.status}`}><b>Quick summary</b><p>{reading.explanation}</p></div>
        {(explanation || guide?.impact || guide?.habits) && <div className="mp-lab-plain-grid">{explanation && <div><b>What does this test measure?</b><p>{explanation}</p></div>}{guide?.impact && <div><b>Why does it matter?</b><p>{guide.impact}</p></div>}{guide?.habits && <div className="mp-lab-plain-wide"><b>Food & daily habits</b><p>{guide.habits}</p></div>}</div>}
        {lab.clinician_note && <div className="mp-clinician-note"><b>Clinician explanation</b><p className="mp-preserve">{lab.clinician_note}</p></div>}
        {source && <a className="mp-source" href={source} target="_blank" rel="noreferrer">Learn about this test ↗</a>}
      </article>;
    })}</div><p className="mp-footnote">The reference range comes from this laboratory report and does not replace a patient-specific treatment target. <a href={labGuide} target="_blank" rel="noreferrer">How to read lab results · MedlinePlus ↗</a></p></section>}
    {e.medications.length > 0 && <section className="mp-detail-section"><h3><Pill />Medications at this visit <span className="mp-count">{e.medications.length}</span></h3><div className="mp-med-list">{e.medications.map(m => <article key={m.id}><div><h4>{m.name} <span className="mp-muted">{m.dose}</span></h4><p>{[m.route, m.frequency, m.duration].filter(Boolean).join(' · ')}</p>{m.instructions && <p className="mp-muted mp-preserve">{m.instructions}</p>}</div><span className={`mp-badge ${m.status === 'active' ? 'teal' : ''}`}>{medicineLabels[m.status]}</span></article>)}</div></section>}
    {e.procedures.length > 0 && <section className="mp-detail-section"><h3><Activity />Services & procedures</h3>{e.procedures.map(p => <article className="mp-procedure" key={p.id}><h4>{p.name}</h4><p className="mp-preserve">{p.result || 'No result recorded.'}</p>{p.explanation && <p className="mp-muted mp-preserve">{p.explanation}</p>}</article>)}</section>}
    <section data-annotate={`visit-${e.id}-treatment`} data-annotation-label="Treatment plan" className="mp-treatment"><h3>Treatment & follow-up plan</h3><p className="mp-preserve">{e.treatment_plan || 'No plan recorded.'}</p>{(e.follow_up || e.follow_up_date) && <div className="mp-followup"><strong>{e.follow_up_date ? `Next appointment: ${formatDate(e.follow_up_date)}` : 'Continue monitoring'}</strong><p className="mp-preserve">{e.follow_up}</p></div>}</section>
    <section data-annotate={`visit-${e.id}-doctor`} data-annotation-label="Clinician information" className="mp-doctor"><div className="mp-doctor-avatar"><Stethoscope /></div><div><h4>{e.clinician.name}</h4><p>{e.clinician.specialty}</p><p><Building2 size={14} />{e.clinician.facility}</p><p className="mp-muted">{[e.clinician.public_phone, e.clinician.registration].filter(Boolean).join(' · ')}</p></div></section>
  </div>;
}
