'use client';

import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  FileSearch,
  FileText,
  Info,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';

import Link from '@/components/app-link';
import MediPassBrand from '@/components/medipass-brand';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  CoverageAnalysis,
  NetworkStatus,
  PolicyProfile,
} from '@/lib/insurance-analysis';

type InsuranceDocument = {
  id: string;
  name: string;
  plan_name: string;
  byte_size: number;
  page_count: number;
  extraction_status: string;
  created_at: string;
  profile: PolicyProfile | null;
  download_url: string;
};

type SavedAnalysis = {
  id: string;
  document_id: string;
  document_name: string;
  condition: string;
  network_status: string;
  estimated_cost: number | null;
  created_at: string;
  result: CoverageAnalysis | null;
};

type LibraryPayload = {
  documents?: InsuranceDocument[];
  analyses?: SavedAnalysis[];
  error?: string;
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function InsuranceWorkspace() {
  const [documents, setDocuments] = useState<InsuranceDocument[]>([]);
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [condition, setCondition] = useState('');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('in-network');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeAnalysis, setActiveAnalysis] = useState<SavedAnalysis | null>(null);

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/insurance/documents', { cache: 'no-store' });
      const payload = await response.json() as LibraryPayload;
      if (!response.ok) throw new Error(payload.error || 'Unable to load the SBC library.');
      const nextDocuments = payload.documents ?? [];
      const nextAnalyses = (payload.analyses ?? []).filter((item) => item.result);
      setDocuments(nextDocuments);
      setAnalyses(nextAnalyses);
      setSelectedDocumentId((current) => current && nextDocuments.some((item) => item.id === current)
        ? current
        : nextDocuments[0]?.id ?? '');
      setActiveAnalysis((current) => current ?? nextAnalyses[0] ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the SBC library.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadLibrary);
  }, [loadLibrary]);

  async function uploadDocument(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/insurance/documents', { method: 'POST', body });
      const payload = await response.json() as { document?: InsuranceDocument; error?: string };
      if (!response.ok || !payload.document) throw new Error(payload.error || 'Unable to save the SBC document.');
      setDocuments((current) => [payload.document!, ...current]);
      setSelectedDocumentId(payload.document.id);
      setFile(null);
      setFileInputKey((current) => current + 1);
      setNotice('SBC saved. You can select this document for future analyses.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the SBC document.');
    } finally {
      setUploading(false);
    }
  }

  async function runAnalysis(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setAnalyzing(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/insurance/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: selectedDocumentId,
          condition,
          network_status: networkStatus,
          estimated_cost: estimatedCost,
        }),
      });
      const payload = await response.json() as { analysis?: SavedAnalysis; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || 'Unable to create an estimate.');
      setActiveAnalysis(payload.analysis);
      setAnalyses((current) => [payload.analysis!, ...current].slice(0, 8));
      setNotice('The analysis was saved to demo history.');
      requestAnimationFrame(() => document.getElementById('insurance-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create an estimate.');
    } finally {
      setAnalyzing(false);
    }
  }

  function reopenAnalysis(item: SavedAnalysis) {
    setActiveAnalysis(item);
    setSelectedDocumentId(item.document_id);
    setCondition(item.condition);
    setNetworkStatus(item.network_status as NetworkStatus);
    setEstimatedCost(item.estimated_cost === null ? '' : String(item.estimated_cost));
    requestAnimationFrame(() => document.getElementById('insurance-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/editor" className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary" aria-label="Return to the MediPass portal">
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/" className="flex min-h-11 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-primary" aria-label="MediPass · Home"><MediPassBrand compact subtitle="INSURANCE" /></Link>
          <div className="ml-auto hidden items-center gap-2 text-sm text-slate-500 dark:text-slate-400 sm:flex"><LockKeyhole className="size-4 text-blue-700 dark:text-blue-400" />SBC files are stored in a private document library</div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-7 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"><ShieldCheck className="size-3.5" />DEMO TOOL</Badge>
            <h1 className="mt-4 font-heading text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Insurance Policy Check</h1>
            <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">Select a saved Summary of Benefits and Coverage (SBC), then describe the condition and expected service to review possible coverage conditions and estimated costs.</p>
          </div>
          <div className="flex max-w-md items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <Info className="mt-0.5 size-4 shrink-0" />This result is not a benefit determination or final insurer bill.
          </div>
        </div>

        {error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span>{loading && <Loader2 className="ml-auto size-4 animate-spin" />}</div>}
        {notice && <output className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{notice}</output>}

        <section className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" aria-label="SBC analysis setup">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-semibold text-blue-700 dark:text-blue-300">STEP 1</p><h2 className="mt-1 text-xl font-semibold">Choose an SBC document</h2></div>
              <FileText className="size-6 text-slate-400" />
            </div>
            <form className="mt-5" onSubmit={uploadDocument}>
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-blue-300 bg-blue-50/60 px-5 text-center transition hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 dark:hover:bg-blue-950/50">
                <UploadCloud className="size-7 text-blue-700 dark:text-blue-300" />
                <span className="mt-3 font-semibold">{file ? file.name : 'Upload an SBC PDF'}</span>
                <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">{file ? formatBytes(file.size) : 'Up to 8 MB · use synthetic or de-identified data only'}</span>
                <input key={fileInputKey} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </label>
              {file && <Button type="submit" disabled={uploading} className="mt-3 h-11 w-full rounded-xl bg-primary hover:bg-primary/90">{uploading ? <><Loader2 className="size-4 animate-spin" />Reading and saving SBC…</> : <><UploadCloud className="size-4" />Save document to library</>}</Button>}
            </form>
            <p className="mt-2 text-xs leading-5 text-slate-400">The demo checks file type and size only; malware scanning is not implemented.</p>

            <div className="mt-5 flex items-center justify-between"><h3 className="text-sm font-semibold">Saved documents</h3><span className="text-sm text-slate-400">{documents.length} documents</span></div>
            {loading ? (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-7 text-sm text-slate-500 dark:border-slate-700"><Loader2 className="size-4 animate-spin" />Loading library…</div>
            ) : documents.length ? (
              <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1">
                {documents.map((document) => {
                  const selected = document.id === selectedDocumentId;
                  return <div key={document.id} className={`rounded-2xl border p-4 transition ${selected ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:ring-blue-950' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'}`}>
                    <button type="button" onClick={() => setSelectedDocumentId(document.id)} className="w-full text-left" aria-label={`Select ${document.name}`} aria-pressed={selected}>
                      <span className="flex items-start gap-3"><span className={`mt-1 size-4 shrink-0 rounded-full border-2 ${selected ? 'border-blue-700 bg-primary ring-2 ring-white dark:ring-slate-900' : 'border-slate-300 dark:border-slate-600'}`} /><span className="min-w-0"><strong className="block truncate text-sm">{document.name}</strong><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{document.page_count || 'Unknown'} pages · {formatBytes(document.byte_size)} · {formatDate(document.created_at)}</span></span></span>
                    </button>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200/70 pt-3 dark:border-slate-700">
                      <Badge variant="outline" className={document.extraction_status === 'document-text' ? 'border-blue-200 text-blue-800 dark:border-blue-800 dark:text-blue-200' : 'border-amber-200 text-amber-800 dark:border-amber-800 dark:text-amber-200'}>{document.extraction_status === 'document-text' ? 'Text extracted' : 'Simulated data'}</Badge>
                      <Link href={document.download_url} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"><Download className="size-4" />Download</Link>
                    </div>
                  </div>;
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-slate-200 px-4 py-6 text-center dark:border-slate-700"><FileSearch className="mx-auto size-6 text-slate-400" /><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Upload an SBC once and it will appear here for reuse.</p></div>
            )}
          </div>

          <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6" onSubmit={runAnalysis}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-semibold text-blue-700 dark:text-blue-300">STEP 2</p><h2 className="mt-1 text-xl font-semibold">Describe the care need</h2></div>
              <Sparkles className="size-6 text-blue-500" />
            </div>
            {selectedDocument && <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm dark:bg-slate-950"><FileText className="size-4 shrink-0 text-blue-700 dark:text-blue-300" /><span className="min-w-0"><span className="text-slate-500 dark:text-slate-400">Using: </span><strong className="truncate">{selectedDocument.name}</strong></span></div>}
            <label className="mt-5 block text-sm font-semibold" htmlFor="insurance-condition">Condition and expected service</label>
            <Textarea id="insurance-condition" value={condition} onChange={(event) => setCondition(event.target.value)} rows={6} maxLength={3000} className="mt-2 resize-y rounded-2xl border-slate-300 bg-white text-base leading-7 dark:border-slate-700 dark:bg-slate-950" placeholder="Example: I have knee pain and my clinician recommended an MRI at an in-network facility." />
            <p className="mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400">A condition name alone is not enough to estimate benefits. Include the expected visit, lab test, imaging study, or procedure.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Provider network status<select value={networkStatus} onChange={(event) => setNetworkStatus(event.target.value as NetworkStatus)} className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"><option value="in-network">In network</option><option value="out-of-network">Out of network</option><option value="unknown">Unknown</option></select></label>
              <label className="text-sm font-semibold" htmlFor="insurance-cost">Estimated cost (USD)<Input id="insurance-cost" value={estimatedCost} onChange={(event) => setEstimatedCost(event.target.value)} type="number" min="1" max="100000" step="0.01" placeholder="Example: 1200" className="mt-2 h-11 rounded-xl border-slate-300 bg-white font-normal dark:border-slate-700 dark:bg-slate-950" /></label>
            </div>
            <Button type="submit" disabled={!selectedDocumentId || condition.trim().length < 5 || analyzing} className="mt-6 h-12 w-full rounded-xl bg-primary text-base hover:bg-primary/90">{analyzing ? <><Loader2 className="size-4 animate-spin" />Analyzing terms…</> : <><Sparkles className="size-4" />{selectedDocumentId ? 'Analyze benefits' : 'Select an SBC to analyze'}</>}</Button>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[['Coverage conditions', CheckCircle2], ['SBC sources', FileSearch], ['Cost estimate', ShieldCheck]].map(([label, Icon]) => (
                <div key={String(label)} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300"><Icon className="size-4 text-blue-700 dark:text-blue-300" />{String(label)}</div>
              ))}
            </div>
          </form>
        </section>

        {activeAnalysis?.result && <AnalysisResult analysis={activeAnalysis} />}

        {analyses.length > 0 && <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6" aria-labelledby="analysis-history-title">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-500 dark:text-slate-400">SAVED IN DATABASE</p><h2 id="analysis-history-title" className="mt-1 text-xl font-semibold">Analysis history</h2></div><Clock3 className="size-5 text-slate-400" /></div>
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {analyses.map((item) => <button type="button" key={item.id} onClick={() => reopenAnalysis(item)} className="rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-700 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"><span className="flex items-center justify-between gap-3"><strong className="truncate text-sm">{item.document_name}</strong><span className="shrink-0 text-xs text-slate-400">{formatDate(item.created_at)}</span></span><span className="mt-1 block truncate text-sm text-slate-500 dark:text-slate-400">{item.condition}</span></button>)}
          </div>
        </section>}

        {!loading && error && <div className="mt-6 text-center"><Button type="button" variant="outline" onClick={() => void loadLibrary()}><RefreshCw className="size-4" />Try again</Button></div>}
      </div>
    </main>
  );
}

function AnalysisResult({ analysis }: { analysis: SavedAnalysis }) {
  const result = analysis.result!;
  const statusTone = result.status === 'likely-covered'
    ? 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100'
    : result.status === 'conditional'
      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
      : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100';
  return <section id="insurance-result" className="scroll-mt-6 mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-labelledby="insurance-result-title">
    <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-sm font-semibold text-blue-700 dark:text-blue-300">ESTIMATED RESULT</p><h2 id="insurance-result-title" className="mt-1 text-2xl font-semibold">{result.service}</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">SBC: {analysis.document_name} · {formatDate(analysis.created_at)}</p></div>
        <div className={`max-w-md rounded-2xl border px-4 py-3 ${statusTone}`}><strong className="block">{result.statusLabel}</strong><span className="mt-1 block text-sm leading-5">{result.coverageSummary}</span></div>
      </div>
    </div>
    {result.extractionMode === 'demo-fallback' && <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100 sm:px-6"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span><strong>Simulation mode:</strong> The PDF did not provide enough extractable text. The benefit levels and amounts below were not read from the uploaded document.</span></div>}
    <div className="grid sm:grid-cols-2 xl:grid-cols-4">
      <MoneyCard label="Allowed amount used" value={result.estimatedAllowedAmount} detail="From entered cost or demo assumption" />
      <MoneyCard label="Estimated plan payment" value={result.estimatedPlanPays} detail="Not the final claim amount" emphasis="plan" />
      <MoneyCard label="Estimated member payment" value={result.estimatedMemberPays} detail="Deductible + copay/coinsurance" emphasis="member" />
      <div className="border-b border-slate-200 p-5 last:border-b-0 dark:border-slate-800 sm:border-r xl:border-b-0 xl:border-r-0"><p className="text-sm text-slate-500 dark:text-slate-400">Estimated member cost</p><div className="mt-3 grid gap-2 text-sm"><span className="flex justify-between gap-3"><span>Deductible</span><strong>{money.format(result.deductibleApplied)}</strong></span><span className="flex justify-between gap-3"><span>Copay</span><strong>{money.format(result.copayApplied)}</strong></span><span className="flex justify-between gap-3"><span>Coinsurance</span><strong>{money.format(result.coinsuranceApplied)}</strong></span></div></div>
    </div>
    <div className="grid border-t border-slate-200 dark:border-slate-800 lg:grid-cols-2">
      <div className="border-b border-slate-200 p-5 dark:border-slate-800 lg:border-b-0 lg:border-r sm:p-6"><h3 className="text-base font-semibold">When might this benefit apply?</h3><ul className="mt-4 grid gap-3">{result.conditions.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600 dark:text-slate-300"><CheckCircle2 className="mt-1 size-4 shrink-0 text-blue-700 dark:text-blue-300" />{item}</li>)}</ul>{result.priorAuthorization && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Written prior authorization must be confirmed before the service is performed.</div>}</div>
      <div className="p-5 sm:p-6"><h3 className="text-base font-semibold">Sources and assumptions</h3><div className="mt-4 grid gap-3">{result.citations.map((citation, index) => <div key={`${citation.label}-${index}`} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-sm font-semibold">{citation.label} · {citation.page ? `Page ${citation.page}` : 'Simulated data'}</p><p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{citation.excerpt}</p></div>)}</div><ul className="mt-4 grid gap-2">{result.assumptions.map((item) => <li key={item} className="flex gap-2 text-sm leading-5 text-slate-500 dark:text-slate-400"><Info className="mt-0.5 size-3.5 shrink-0" />{item}</li>)}</ul></div>
    </div>
    <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 sm:px-6">Confirm the CPT/HCPCS code, provider, network status, and remaining deductible with the insurer. Final payment responsibility depends on the claim submitted by the healthcare facility.</div>
  </section>;
}

function MoneyCard({ label, value, detail, emphasis }: { label: string; value: number; detail: string; emphasis?: 'plan' | 'member' }) {
  const tone = emphasis === 'plan' ? 'text-blue-700 dark:text-blue-300' : emphasis === 'member' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-950 dark:text-white';
  return <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:border-r xl:border-b-0"><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><strong className={`mt-2 block text-3xl tracking-[-0.04em] ${tone}`}>{money.format(value)}</strong><p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p></div>;
}
