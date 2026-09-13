'use client';
/* eslint-disable next/no-html-link-for-pages -- This anchor downloads a SQL artifact, not a page. */
import { useEffect, useState } from 'react';
import Link from '@/components/app-link';
import MediPassBrand from '@/components/medipass-brand';
import { ArrowLeft, ArrowRight, CheckCircle2, Database, Download, FileText, RefreshCw, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PortalData } from '@/lib/portal-types';
import { api, ErrorBox } from '../portal/portal-ui';
import { DataExplorer, type DataSnapshot } from './data-explorer';

const tables = [
  ['01','Patient profiles','mp_portal_patients','Name, date of birth, medical record number, and contact information.'],
  ['02','Shared conditions','mp_patient_conditions','Each condition belongs to one patient and is not repeated on every visit.'],
  ['03','Shared allergies','mp_patient_allergies','Substance, reaction, and severity.'],
  ['04','Clinicians','mp_clinicians','Name, specialty, facility, and public contact information.'],
  ['05','Visits','mp_encounters','One row per visit: symptoms, assessment, plan, and clinician.'],
  ['06','Lab results','mp_encounter_labs','Clinical name, result, unit, reference range, and explanation.'],
  ['07','Visit medications','mp_encounter_medications','Medication, dose, directions, duration, and status.'],
  ['08','Services / procedures','mp_encounter_procedures','Services performed and their results.'],
  ['09','Change requests','mp_feedback','Website feedback, location, priority, and progress.'],
  ['10','Save history','mp_portal_audit','Tracks created or edited records, versions, and timestamps.'],
];
export default function DataPage() {
  const [data, setData] = useState<(PortalData & DataSnapshot) | null>(null), [error, setError] = useState(''), [checking, setChecking] = useState(false);
  async function load() { setChecking(true); try { setData(await api<PortalData & DataSnapshot>('/api/portal/data')); setError(''); } catch (e) { setError((e as Error).message); } finally { setChecking(false); } }
  useEffect(() => { void Promise.resolve().then(load); }, []);
  const connected = data?.storage.provider === 'supabase' && !error;
  const projectRef = data?.storage.project_url ? new URL(data.storage.project_url).hostname.split('.')[0] : 'gsllxxdewmksjbcnxgvp';
  return <main className="mp-standalone"><nav className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5 dark:border-slate-800" aria-label="Data navigation"><Link href="/" className="inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600"><MediPassBrand /></Link><Link className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600 hover:text-blue-600 dark:text-slate-300" href="/editor"><ArrowLeft size={17} />Back to clinical portal</Link></nav><header className="mp-page-heading"><div><p className="mp-eyebrow">WHERE RECORDS ARE STORED</p><h1>Data & Supabase</h1><p>Records are organized by patient, shared information, and individual visits.</p></div><Button variant="outline" disabled={checking} onClick={() => void load()}><RefreshCw className={checking ? 'animate-spin' : ''} />Check connection</Button></header><ErrorBox message={error} />
    <section className={`mp-connection-panel ${connected ? 'connected' : ''}`}><div className="mp-connection-icon">{connected ? <CheckCircle2 /> : <Database />}</div><div><h2>{connected ? 'Saving directly to Supabase' : 'Supabase is not connected'}</h2><p>{connected ? data?.storage.project_url : 'The demo is currently using app storage. No portal data has been confirmed as written to your Supabase project.'}</p>{<a className="mp-text-action" href={`https://supabase.com/dashboard/project/${projectRef}/editor`} target="_blank" rel="noreferrer">Open your Supabase project ↗</a>}</div></section>
    <div className="mp-data-flow"><div><Server /><b>Clinician enters</b><span>Save the complete visit</span></div><ArrowRight /><div><Database /><b>{connected ? 'Supabase' : 'Demo storage'}</b><span>Linked, versioned records</span></div><ArrowRight /><div><FileText /><b>Patient reviews</b><span>Same data with explanations</span></div></div>
    {!connected && <section className="mp-panel mp-setup"><h2>Complete your project connection</h2><p>The dashboard link does not contain credentials that let the app write data. Configure the exact Project URL and secret key in the private server environment.</p><ol><li>Open the Supabase project, go to SQL Editor, and run the schema file below.</li><li>Add <code>SUPABASE_URL</code> and <code>SUPABASE_SECRET_KEY</code> to <code>.env.local</code> for local use, or to the Sites environment variables for the hosted app.</li><li>Restart the app and select “Check connection.” On the first connection, records and feedback saved in the demo are copied to the new Supabase workspace; if it is empty, the app creates five sample patients.</li></ol><a className="mp-button" href="/api/portal/schema"><Download size={16} />Download Supabase schema (.sql)</a><p className="mp-footnote">Configure secret keys on the server only. The original demo is retained. Existing Supabase data is never overwritten.</p></section>}
    {data && !error && <DataExplorer data={data} />}
    <details className="mp-panel"><summary>Supabase data categories</summary><div className="mp-schema-list">{tables.map(([number,label,table,detail]) => <article key={table}><span className="mp-schema-number">{number}</span><div><h3>{label}</h3><p>{detail}</p></div><code>{table}</code>{connected && <a href={`https://supabase.com/dashboard/project/${projectRef}/editor`} target="_blank" rel="noreferrer" aria-label={`Open ${label}`}>↗</a>}</article>)}</div></details><p className="mp-footnote">New tables use the mp_ prefix. Tables from the earlier records demo remain available under “Previous records.”</p>
  </main>;
}
