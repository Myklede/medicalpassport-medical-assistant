'use client';
import { useEffect, useState } from 'react';
import Link from '@/components/app-link';
import MediPassBrand from '@/components/medipass-brand';
import { ArrowLeft, Printer } from 'lucide-react';
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
        if (!patientId) throw new Error('Patient ID is missing. Open the print view from a visit card.');
        const [portal, result] = await Promise.all([api<PortalData>('/api/portal', undefined, controller.signal), api<{ encounters: Encounter[] }>(`/api/portal/encounters?patient_id=${encodeURIComponent(patientId)}`, undefined, controller.signal)]);
        const p = portal.patients.find(x => x.id === patientId), e = result.encounters.find(x => x.id === encounterId);
        if (!p || !e) throw new Error('This record could not be found.'); setPatient(p); setEncounter(e);
      } catch (e) { if ((e as Error).name !== 'AbortError') setError((e as Error).message); }
    }
    void load(); return () => controller.abort();
  }, [encounterId]);
  return <div className="mp-document-page"><header className="mp-document-toolbar mp-no-print"><Link href="/" className="rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600"><MediPassBrand compact /></Link><div className="flex flex-wrap items-center gap-3"><Link className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600 hover:text-blue-600 dark:text-slate-300" href={patient ? `/patient?patient=${patient.id}` : '/patient'}><ArrowLeft size={18} />Back to record</Link><Button disabled={!encounter} onClick={() => window.print()}><Printer />Print / Save PDF</Button></div></header><ErrorBox message={error} />{!encounter && !error && <Busy />}{patient && encounter && <article className="mp-document"><div className="mp-document-header"><div><MediPassBrand /></div><span>VISIT RECORD · SYNTHETIC DEMO</span></div><h1>{encounter.reason}</h1><p className="mp-muted">Visit date {formatDate(encounter.visit_date)} · {encounter.clinician.facility}</p><section className="mp-document-patient"><strong>{patient.display_name}</strong><p>{patient.medical_record_number} · Date of birth {formatDate(patient.birth_date)} · Blood type {patient.blood_type || 'unknown'}</p><p><b>Allergies currently recorded:</b> {patient.allergies.map(a => `${a.substance} (${a.reaction})`).join('; ') || 'Not recorded'}</p><p><b>Shared conditions / history:</b> {patient.conditions.map(c => c.name).join('; ') || 'Not recorded'}</p><small>Shared information updated {formatDate(patient.updated_at)}.</small></section><EncounterDetail encounter={encounter} /><footer className="mp-document-footer">Synthetic document · Do not use demo prescriptions for treatment. Visit record updated {formatDate(encounter.updated_at)}.</footer></article>}</div>;
}
