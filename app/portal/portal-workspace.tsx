'use client';
/* eslint-disable next/no-html-link-for-pages -- Sites sign-in is a dispatcher-owned top-level navigation. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/app-link';
import MediPassBrand from '@/components/medipass-brand';
import { Activity, ArrowLeftRight, ChevronDown, ChevronRight, ClipboardPlus, Database, FileHeart, FileText, HeartPulse, History, MessageSquare, Pencil, Pill, Plus, Printer, RefreshCw, Search, ShieldCheck, Stethoscope, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { PortalData, Patient, Encounter, Condition } from '@/lib/portal-types';
import { currentMedicines } from '@/lib/lab-interpretation';
import { educationForCondition } from '@/lib/patient-education';
import { api, Busy, ErrorBox, age, formatDate, sexLabels, SectionHeading, severityLabels } from './portal-ui';
import { PatientForm, blankPatient } from './patient-form';
import { EncounterForm, blankEncounter } from './encounter-form';
import { EncounterDetail } from './encounter-detail';
import { PatientEducation } from './patient-education';
import { IpsExportDialog } from './ips-export-dialog';

export function PortalWorkspace({ mode }: { mode: 'hospital' | 'patient' }) {
  const hospital = mode === 'hospital';
  const visitRequest = useRef(0);
  const syncChannel = useRef<BroadcastChannel | null>(null);
  const [data, setData] = useState<PortalData | null>(null), [selectedId, setSelectedId] = useState('');
  const [encounters, setEncounters] = useState<Encounter[]>([]), [visitsLoading, setVisitsLoading] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [visitError, setVisitError] = useState('');
  const [search, setSearch] = useState(''), [visitSearch, setVisitSearch] = useState(''), [expanded, setExpanded] = useState<string | null>(null), [tab, setTab] = useState('visits');
  const [editPatient, setEditPatient] = useState<Patient | null>(null), [editEncounter, setEditEncounter] = useState<Encounter | null>(null), [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    try {
      const result = await api<PortalData>('/api/portal');
      setData(result); setError('');
      setSelectedId(current => {
        const requested = current || new URLSearchParams(window.location.search).get('patient') || '';
        return result.patients.some(p => p.id === requested) ? requested : result.patients[0]?.id || '';
      });
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const loadVisits = useCallback(async (id: string, signal?: AbortSignal) => {
    if (!id) return;
    const requestNumber = ++visitRequest.current;
    setVisitsLoading(true); setVisitError('');
    try {
      const result = await api<{ encounters: Encounter[] }>(`/api/portal/encounters?patient_id=${encodeURIComponent(id)}`, undefined, signal);
      if (requestNumber !== visitRequest.current) return;
      setEncounters(result.encounters); setExpanded(current => current && result.encounters.some(e => e.id === current) ? current : result.encounters[0]?.id || null);
    } catch (e) { if ((e as Error).name !== 'AbortError' && requestNumber === visitRequest.current) setVisitError((e as Error).message); } finally { if (!signal?.aborted && requestNumber === visitRequest.current) setVisitsLoading(false); }
  }, []);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setEncounters([]); setExpanded(null); setVisitSearch('');
      return loadVisits(selectedId, controller.signal);
    });
    const url = new URL(window.location.href); url.searchParams.set('patient', selectedId); window.history.replaceState(window.history.state, '', url.pathname + url.search);
    return () => controller.abort();
  }, [selectedId, loadVisits]);
  useEffect(() => {
    const reveal = (event: Event) => {
      const detail = (event as CustomEvent<{ encounter_id?: string; selector?: string }>).detail;
      setTab(detail.selector?.includes('general-note') ? 'profile' : 'visits');
      if (detail.encounter_id) setExpanded(detail.encounter_id);
    };
    window.addEventListener('medipass-reveal', reveal);
    return () => window.removeEventListener('medipass-reveal', reveal);
  }, []);
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false, pending = false;
    const controller = new AbortController();
    const refreshWhenVisible = async () => {
      if (pending || document.visibilityState !== 'visible' || editPatient || editEncounter ||
          document.querySelector('[data-slot="dialog-content"]') || document.body.classList.contains('mp-annotation-mode')) return;
      pending = true;
      const requestNumber = visitRequest.current;
      try {
        const result = await api<PortalData & { encounters: Encounter[] }>('/api/portal/data', undefined, controller.signal);
        if (cancelled || requestNumber !== visitRequest.current) return;
        setData({ patients: result.patients, clinicians: result.clinicians, storage: result.storage, demo: true });
        const visits = result.encounters.filter(e => e.patient_id === selectedId);
        setEncounters(visits);
        setExpanded(current => current && !visits.some(e => e.id === current) ? null : current);
        setError(''); setVisitError('');
      } catch (e) { if (!cancelled && (e as Error).name !== 'AbortError') setError((e as Error).message); }
      finally { pending = false; }
    };
    // Broadcast contains no medical data. Other devices refresh while visible.
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('medipass-portal');
    syncChannel.current = channel;
    if (channel) channel.onmessage = () => { void refreshWhenVisible(); };
    const interval = window.setInterval(() => { void refreshWhenVisible(); }, 5000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      cancelled = true; controller.abort(); window.clearInterval(interval); channel?.close();
      if (syncChannel.current === channel) syncChannel.current = null;
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [selectedId, editPatient, editEncounter]);
  const patient = data?.patients.find(p => p.id === selectedId);
  const patients = useMemo(() => (data?.patients ?? []).filter(p => `${p.display_name} ${p.medical_record_number}`.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(search.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))), [data, search]);
  const medicines = useMemo(() => currentMedicines(encounters), [encounters]);
  const filteredVisits = encounters.filter(e => `${e.reason} ${e.diagnosis} ${e.plain_diagnosis} ${e.clinician.name} ${e.visit_date}`.toLocaleLowerCase().includes(visitSearch.toLocaleLowerCase()));
  function select(id: string) { if (id === selectedId) return; ++visitRequest.current; setEncounters([]); setExpanded(null); setVisitsLoading(true); setVisitError(""); setSelectedId(id); setNotice(''); setTab('visits'); }
  async function refresh() { await load(); await loadVisits(selectedId); }
  function patientSaved(saved: Patient) {
    ++visitRequest.current; syncChannel.current?.postMessage('changed');
    setData(old => old ? { ...old, patients: [...old.patients.filter(p => p.id !== saved.id), saved].sort((a,b) => a.medical_record_number.localeCompare(b.medical_record_number)) } : old);
    setSelectedId(saved.id); setEditPatient(null); setNotice(data?.storage.provider === 'supabase' ? 'Shared patient information saved to Supabase.' : 'Saved to demo storage. This has NOT been written to your Supabase project.');
  }
  function encounterSaved(saved: Encounter) {
    ++visitRequest.current; syncChannel.current?.postMessage('changed');
    setEncounters(old => [...old.filter(e => e.id !== saved.id), saved].sort((a,b) => b.visit_date.localeCompare(a.visit_date) || b.created_at.localeCompare(a.created_at)));
    setExpanded(saved.id); setEditEncounter(null); setTab('visits'); setNotice(data?.storage.provider === 'supabase' ? 'The complete visit was saved to Supabase. Patient View is up to date.' : 'Visit saved in demo storage. This has NOT been written to your Supabase project.'); void load();
  }
  return <div className={`mp-app ${hospital ? 'mp-hospital' : 'mp-patient'}`}>
    <aside className="mp-rail"><Link className="mb-10 inline-flex rounded-xl px-2 text-white focus-visible:outline-2 focus-visible:outline-blue-400" href="/"><MediPassBrand /></Link><p className="mp-rail-label">CARE WORKSPACE</p><nav><Link href="/editor" className={hospital ? 'active' : ''}><Stethoscope />Hospital portal</Link><Link href={selectedId ? `/patient?patient=${selectedId}` : '/patient'} className={!hospital ? 'active' : ''}><FileHeart />Patient View</Link><Link href="/feedback"><MessageSquare />Change requests</Link><Link href="/data"><Database />Data & Supabase</Link></nav><div className="mp-rail-divider" /><p className="mp-rail-label">OTHER TOOLS</p><nav><Link href={selectedId ? `/records?patient=${encodeURIComponent(selectedId)}` : '/records'}><History />Previous records</Link><Link href="/insurance"><ShieldCheck />Insurance Check</Link><Link href="/medications"><Pill />Medication Match</Link><Link href="/wounds"><Activity />Wound Lab</Link><Link href="/therapy"><HeartPulse />Motion Lab</Link></nav><div className="mp-rail-bottom"><ShieldCheck /><div><strong>Private demo workspace</strong><p>Simulated patients & clinicians</p></div></div></aside>
    <div className="mp-surface"><header className="mp-topbar"><div><Link href="/" className="mb-4 inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600 min-[1081px]:hidden"><MediPassBrand compact /></Link><p className="mp-eyebrow">{hospital ? 'FOR HEALTHCARE STAFF' : 'YOUR RECORD'}</p><h1>{hospital ? 'Hospital portal' : 'Health record'}</h1></div><div className="mp-top-actions"><Link className={`mp-storage-pill ${data?.storage.provider === 'supabase' ? 'connected' : ''}`} href="/data"><span />{data?.storage.provider === 'supabase' ? 'Supabase connected' : 'Demo · Supabase pending'}</Link><Button variant="outline" onClick={() => void refresh()} aria-label="Refresh records"><RefreshCw /></Button><Link className="mp-button" href={`${hospital ? '/patient' : '/editor'}${selectedId ? `?patient=${selectedId}` : ''}`}><ArrowLeftRight size={16} />{hospital ? 'Open Patient View' : 'Open hospital portal'}</Link></div></header>
    <div className="mp-demo-strip"><span className="mp-demo-dot" />{data?.patients.length ?? 5} simulated patients · one shared record across two views<span className="mp-strip-right">Synthetic data for testing entry, editing, and record review</span></div>
    <nav className="mp-mobile-links" aria-label="Data, feedback, and tools"><Link href="/data"><Database size={16} />Data & Supabase</Link><Link href="/feedback"><MessageSquare size={16} />Change requests</Link><Link href={selectedId ? `/records?patient=${encodeURIComponent(selectedId)}` : '/records'}><History size={16} />Previous records</Link><Link href="/insurance"><ShieldCheck size={16} />Insurance Check</Link><Link href="/medications"><Pill size={16} />Medication Match</Link><Link href="/wounds"><Activity size={16} />Wound Lab</Link><Link href="/therapy"><HeartPulse size={16} />Motion Lab</Link></nav>
    {data && data.storage.provider !== 'supabase' && <output className="mp-storage-warning">Records are in demo storage and have not been written to Supabase. <Link href="/data">Finish connecting your project ↗</Link></output>}<ErrorBox message={error} />{error && <div className="mp-recovery"><Button variant="outline" onClick={() => void load()}>Try again</Button><a href="/signin-with-chatgpt?return_to=/editor" target="_top">Sign in to open the demo</a><Link href="/data">View data connection</Link></div>}
    {loading ? <Busy /> : data && <div className="mp-workspace"><aside className="mp-roster"><div className="mp-roster-title"><h2><Users size={18} />Patients <span>{data.patients.length}</span></h2>{hospital && <Button size="icon" variant="outline" onClick={() => setEditPatient(blankPatient())} aria-label="Add patient"><Plus /></Button>}</div><label className="mp-search"><Search size={17} /><input aria-label="Search patients" placeholder="Name or record number…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</label><div className="mp-patient-list">{patients.map((p,i) => <button key={p.id} className={`mp-patient-row ${p.id === selectedId ? 'selected' : ''}`} onClick={() => select(p.id)} aria-pressed={p.id === selectedId}><span className={`mp-avatar color-${i%5}`}>{p.display_name.split(' ').slice(-2).map(n => n[0]).join('')}</span><span className="mp-patient-row-text"><strong>{p.display_name}</strong><small>{p.medical_record_number} · age {age(p.birth_date)}</small><span>{p.conditions[0]?.name || 'No condition recorded'}</span></span><ChevronRight size={16} /></button>)}</div>{patients.length === 0 && <p className="mp-empty-inline">No patients found.</p>}<div className="mp-roster-note"><Users size={17} /><p>{hospital ? 'Select a patient to enter or update a visit.' : 'Select a person to preview their Patient View.'}</p></div></aside>
    <main className="mp-record"><div className="mp-breadcrumb">{hospital ? 'Patient list' : 'Patient View'}<ChevronRight size={13} />{patient?.medical_record_number || 'Record'}</div>{notice && <output className="mp-success">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16} /></button></output>}
      {patient ? <><section data-annotate="patient-heading" data-annotation-label="Patient information" className="mp-patient-heading"><div><p className="mp-eyebrow">{hospital ? 'PATIENT RECORD' : 'HEALTH INFORMATION'}</p><h2>{patient.display_name}</h2><p>{sexLabels[patient.sex]} <span>·</span> age {age(patient.birth_date)} <span>·</span> {formatDate(patient.birth_date)} <span>·</span> Blood type {patient.blood_type || 'unknown'}</p></div><div className="mp-patient-heading-actions"><IpsExportDialog patient={patient} encounters={encounters} storage={data.storage} />{hospital && <Button variant="outline" onClick={() => setEditPatient(patient)}><Pencil />Edit shared information</Button>}</div></section>
      <div className="mp-summary-line"><span><FileText />{encounters.length} visits</span><span><Pill />{medicines.length} current medications recorded</span><span><History />Latest: {encounters[0] ? formatDate(encounters[0].visit_date) : 'None'}</span></div>
      <div className="mp-shared-panels"><section data-annotate="patient-conditions" data-annotation-label="Conditions and medical history" className="mp-baseline"><div className="mp-panel-label"><FileHeart size={17} />Shared conditions & history</div>{patient.conditions.length ? patient.conditions.map(c => <ConditionSummary key={c.id} condition={c} educationOpen={!hospital} />) : <p className="mp-muted">No conditions recorded.</p>}</section><section data-annotate="patient-allergies" data-annotation-label="Allergies" className={`mp-baseline ${patient.allergies.length ? 'mp-allergy-panel' : ''}`}><div className="mp-panel-label"><ShieldCheck size={17} />Important allergies</div>{patient.allergies.length ? patient.allergies.map(a => <div key={a.id}><strong>{a.substance}</strong><p>{a.reaction || 'Reaction not recorded'} · {severityLabels[a.severity]}</p>{a.note && <p className="mp-preserve">{a.note}</p>}</div>) : <p className="mp-muted">No allergies are recorded.</p>}</section></div>
      <Tabs value={tab} onValueChange={v => setTab(String(v))}><TabsList variant="line" className="mp-record-tabs"><TabsTrigger value="visits">Visit history</TabsTrigger><TabsTrigger value="medicines">Current medications</TabsTrigger><TabsTrigger value="profile">Shared information</TabsTrigger></TabsList>
        <TabsContent value="visits"><SectionHeading title="One complete record for each visit" note="Open a visit to see its lab results, medications, and instructions.">{hospital && <Button size="lg" onClick={() => setEditEncounter(blankEncounter(patient, data.clinicians[0]))}><ClipboardPlus />Add visit</Button>}</SectionHeading>
          {encounters.length > 2 && <label className="mp-search mp-visit-search"><Search size={16} /><input aria-label="Search visits" placeholder="Search reason, clinician, or date…" value={visitSearch} onChange={e => setVisitSearch(e.target.value)} /></label>}
          <ErrorBox message={visitError} />{visitsLoading ? <Busy label="Loading visits…" /> : filteredVisits.length ? <div className="mp-timeline">{filteredVisits.map((e, i) => <article data-annotate={`visit-${e.id}`} data-encounter-id={e.id} data-annotation-label={`Visit card: ${e.reason}`} className={`mp-visit-card ${expanded === e.id ? 'open' : ''}`} key={e.id}><div className="mp-visit-heading"><button className="mp-visit-toggle" onClick={() => setExpanded(expanded === e.id ? null : e.id)} aria-expanded={expanded === e.id} aria-controls={`visit-body-${e.id}`}><span className="mp-date-box"><strong>{e.visit_date.slice(8,10)}</strong><span>MO {e.visit_date.slice(5,7)} · {e.visit_date.slice(0,4)}</span></span><span className="mp-visit-title"><span className="mp-visit-meta">{i === 0 && !visitSearch ? <b>LATEST VISIT</b> : 'VISIT RECORD'}<span>{e.clinician.specialty}</span></span><strong>{e.reason}</strong><span>{e.clinician.name} · {e.clinician.facility}</span></span><ChevronDown className={expanded === e.id ? 'mp-rotate' : ''} size={18} /></button></div><div className="mp-visit-toolbar"><div className="mp-mini-counts"><span><FlaskIcon />{e.labs.length} labs</span><span><Pill size={14} />{e.medications.length} medications</span><span>{e.procedures.length} services</span></div><div><Link href={`/visit/${e.id}?patient=${patient.id}`} className="mp-text-action"><Printer size={15} />Full record / print</Link>{hospital && <Button variant="ghost" onClick={() => setEditEncounter(e)}><Pencil />Edit</Button>}<button className="mp-text-action" onClick={() => window.dispatchEvent(new CustomEvent('medipass-feedback', { detail: { section: `Visit: ${e.reason}`, patient_id: patient.id, encounter_id: e.id } }))} aria-label="Comment on this visit"><MessageSquare size={15} /></button></div></div>{expanded === e.id && <div id={`visit-body-${e.id}`}><EncounterDetail encounter={e} /></div>}</article>)}</div> : <div className="mp-empty-card"><FileText /><h3>{visitSearch ? 'No visits found' : 'No visits yet'}</h3><p>{visitSearch ? 'Try another search term.' : 'Add the first visit from the hospital portal.'}</p></div>}
        </TabsContent>
        <TabsContent value="medicines"><SectionHeading title="Current medications on record" note="Compiled from the latest status for the same medication name, dose, and route." /><div className="mp-med-list mp-panel">{medicines.length ? medicines.map(m => <article key={`${m.name}-${m.dose}-${m.route}`}><div><h4>{m.name} · {m.dose}</h4><p>{[m.route,m.frequency,m.duration].filter(Boolean).join(' · ')}</p><p className="mp-muted">{m.instructions}</p></div><span className="mp-badge teal">Active</span></article>) : <p className="mp-empty-inline">No current medications are recorded.</p>}</div><p className="mp-footnote">This list reflects the saved record. Confirm with a clinician if actual medication use has changed.</p></TabsContent>
        <TabsContent value="profile"><SectionHeading title="Shared information" note="Used across the patient’s entire visit history." /><div className="mp-profile-grid">{[['Record number',patient.medical_record_number],['Date of birth',formatDate(patient.birth_date)],['Phone',patient.phone],['Email',patient.email],['Address',patient.address],['Emergency contact',patient.emergency_contact]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value || 'Not recorded'}</strong></div>)}</div>{patient.general_note && <div data-annotate="general-note" data-annotation-label="General note card" className="mp-panel"><h3>General note</h3><p className="mp-preserve">{patient.general_note}</p></div>}</TabsContent>
      </Tabs><footer className="mp-record-footer">Simulated record · Updated {formatDate(patient.updated_at)}<span>{data.storage.label}</span></footer>
      </> : <div className="mp-empty-card">Select or add a patient to begin.</div>}
    </main></div>}
    </div>{editPatient && <PatientForm key={editPatient.id} initial={editPatient} onClose={() => setEditPatient(null)} onSaved={patientSaved} />}{editEncounter && patient && <EncounterForm key={editEncounter.id} initial={editEncounter} patient={patient} currentMedications={medicines} doctors={data?.clinicians || []} onClose={() => setEditEncounter(null)} onSaved={encounterSaved} />}
  </div>;
}
function FlaskIcon() { return <Activity size={14} />; }
function ConditionSummary({ condition: c, educationOpen }: { condition: Condition; educationOpen: boolean }) {
  const education = educationForCondition(c.name, c.clinical_term);
  return <div><strong>{c.name}</strong>{c.status === 'resolved' && <span className="mp-badge">History</span>}<p>{c.clinical_term}{c.since ? ` · Since ${c.since}` : ''}</p>{c.note && <p className="mp-preserve">{c.note}</p>}{education && <PatientEducation education={education} defaultOpen={educationOpen} />}</div>;
}
