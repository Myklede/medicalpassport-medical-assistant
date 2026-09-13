'use client';

import { useEffect, useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import Image from 'next/image';
import { Camera, CheckCircle2, Clock3, FlaskConical, ImagePlus, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_WOUND_IMAGE_BYTES, type ClinicalBrief } from '@/lib/wound-api';
import { appendWoundVisit, createWoundSession, deleteWoundSession, deleteWoundVisit, getWoundSession, getWoundVisit, listWoundSessions, retryWoundVisit, woundVisitImageUrl, type SavedWoundVisit, type WoundSession, type WoundSessionSummary } from '@/lib/wound-sessions-api';
import { woundBaseline, type WoundPatient } from '@/lib/wound-patients';

const input = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60';
const primary = 'min-h-12 rounded-xl bg-[#2563EB] text-white hover:bg-blue-700';
type Draft = { id: string; file: File | null; capturedAt: string; scale: string; consistent: boolean; hash?: string };
export type WoundWorkflowResult = { session: WoundSession; visit?: SavedWoundVisit; imageUrl?: string; lockedPatient: WoundPatient };
const message = (error: unknown) => error instanceof Error ? error.message : 'Không đọc được dịch vụ theo dõi.';
function localTime(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}
const blank = (id = 'initial', date = localTime()): Draft => ({ id, file: null, capturedAt: date, scale: '', consistent: false });
const dateLabel = (date: string) => new Date(date).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
function alreadySaved(row: Draft, session: WoundSession) {
  const timestamp = new Date(row.capturedAt).getTime();
  const visit = session.visits.find(v => new Date(v.timestamp).getTime() === timestamp);
  return !!visit && !!row.hash && !!session.brief?.objective_measurements.visits.some(v => v.day === visit.day && v.image_sha256 === row.hash);
}
function lockedProfile(patient: WoundPatient, session: WoundSession): WoundPatient {
  // Only stored baseline values override the current catalog; never replace visit history.
  // Legacy sessions may predate FPG/vascular fields: never fill their missing
  // history with today's catalog and claim those values were fused by the model.
  const profile = { ...patient, fpg_mg_dl: null, peripheral_vascular_status: 'unknown', neuropathy_status: 'unknown', vascular_notes: '', neuropathy_notes: '' } as WoundPatient;
  for (const key of Object.keys(woundBaseline(patient))) {
    if (key in session.patient_profile) Object.assign(profile, { [key]: session.patient_profile[key] });
  }
  return profile;
}
function DraftPreview({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => { let valid = true; const src = URL.createObjectURL(file); queueMicrotask(() => { if (valid) setUrl(src); }); return () => { valid = false; URL.revokeObjectURL(src); }; }, [file]);
  return url ? <Image unoptimized width={400} height={250} src={url} alt={'Ảnh chờ gửi: ' + file.name} className="h-36 w-full rounded-lg bg-slate-100 object-contain dark:bg-slate-900" /> : null;
}

export default function WoundVisitWorkflow({ patient, developerMode, onBusyChange, renderBrief }: {
  patient: WoundPatient; developerMode: boolean; onBusyChange: (busy: boolean) => void;
  renderBrief: (brief: ClinicalBrief, context: WoundWorkflowResult) => ReactNode;
}) {
  const [session, setSession] = useState<WoundSession | null>(null);
  const [selected, setSelected] = useState('');
  const [known, setKnown] = useState<WoundSessionSummary[]>([]);
  const [rows, setRows] = useState<Draft[]>(() => [blank()]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [mustReload, setMustReload] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [selectedBrief, setSelectedBrief] = useState<ClinicalBrief | null>(null);
  const [visitLoading, setVisitLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'session' | SavedWoundVisit | null>(null);
  const generation = useRef(0);
  const visitGeneration = useRef(0);
  const serial = useRef(0);
  const alive = useRef(true);
  const gate = useRef(false);
  const camera = useRef<HTMLInputElement>(null);
  const count = session?.visits.length ?? 0;
  const selectedVisit = session?.visits.find(v => v.visit_id === selectedVisitId) ?? session?.visits.at(-1);
  const key = 'medipass-wound-active-v2:' + patient.patient_id;
  const current = (token: number) => alive.current && generation.current === token;

  useEffect(() => { onBusyChange(busy || visitLoading); }, [busy, visitLoading, onBusyChange]);
  useEffect(() => {
    alive.current = true;
    const token = ++generation.current;
    const valid = () => alive.current && token === generation.current;
    listWoundSessions(patient.patient_id).then(async listed => {
      if (!valid()) return;
      setKnown(listed);
      let cached = '';
      try { cached = localStorage.getItem(key) || ''; } catch { /* Optional preference. */ }
      const id = listed.find(s => s.session_id === cached)?.session_id ?? listed[0]?.session_id;
      if (id) {
        const saved = await getWoundSession(id, patient.patient_id);
        if (!valid()) return;
        setSession(saved); setSelected(id); setSelectedVisitId(saved.visits.at(-1)?.visit_id ?? '');
        setVisitLoading(saved.visits.length > 0);
      }
      setMustReload(false);
    }).catch(caught => { if (valid()) { setError(message(caught)); setMustReload(true); } })
      .finally(() => { if (valid()) setBusy(false); });
    return () => { alive.current = false; };
  }, [patient.patient_id, key]);
  useEffect(() => {
    if (!session || !selectedVisitId) return;
    let valid = true;
    const token = ++visitGeneration.current;
    getWoundVisit(session.session_id, selectedVisitId, patient.patient_id)
      .then(brief => { if (valid && token === visitGeneration.current) setSelectedBrief(brief); })
      .catch(caught => { if (valid && token === visitGeneration.current) setError(message(caught)); })
      .finally(() => { if (valid && token === visitGeneration.current) setVisitLoading(false); });
    return () => { valid = false; };
  }, [session, selectedVisitId, patient.patient_id]);

  function remember(id: string) {
    try { localStorage.setItem(key, id); } catch { /* Server listing restores history without local storage. */ }
  }
  function accept(saved: WoundSession) {
    setSession(saved); setSelected(saved.session_id);
    setSelectedVisitId(saved.visits.at(-1)?.visit_id ?? ''); setSelectedBrief(null);
    setVisitLoading(saved.visits.length > 0);
    remember(saved.session_id);
  }
  async function loadSessions(preferred?: string) {
    const token = ++generation.current;
    setBusy(true); setError(''); setMustReload(true);
    try {
      const listed = await listWoundSessions(patient.patient_id);
      if (!current(token)) return;
      setKnown(listed);
      let cached = '';
      try { cached = localStorage.getItem(key) || ''; } catch { /* Optional preference only. */ }
      const id = [preferred, cached, listed[0]?.session_id].find(value => value && listed.some(s => s.session_id === value));
      if (id) {
        const saved = await getWoundSession(id, patient.patient_id);
        if (!current(token)) return;
        accept(saved);
        setRows(previous => previous.some(r => r.file) ? previous.filter(row => !alreadySaved(row, saved)) : [blank()]);
      } else { setSession(null); setSelected(''); setSelectedVisitId(''); setSelectedBrief(null); }
      setMustReload(false);
    } catch (caught) { if (current(token)) setError(message(caught)); }
    finally { if (current(token)) setBusy(false); }
  }
  async function restore(id: string) {
    const token = ++generation.current;
    setBusy(true); setError(''); setSession(null); setSelectedBrief(null); setSelectedVisitId('');
    setSelected(id); setRows([blank()]); setProgress(''); setDeleteTarget(null);
    try {
      const saved = await getWoundSession(id, patient.patient_id);
      if (!current(token)) return;
      accept(saved); setMustReload(false);
    } catch (caught) { if (current(token)) { setError(message(caught)); setMustReload(true); } }
    finally { if (current(token)) setBusy(false); }
  }
  function newSession() {
    generation.current++; visitGeneration.current++;
    setSession(null); setSelected(''); setSelectedVisitId(''); setSelectedBrief(null);
    setVisitLoading(false);
    setRows([blank()]); setProgress(''); setError(''); setDeleteTarget(null);
  }
  function update(id: string, change: Partial<Draft>) {
    setRows(previous => previous.map(row => row.id === id ? { ...row, ...change } : row)); setError('');
  }
  function addFiles(files: File[]) {
    if (!files.length) return;
    const existing = rows.filter(row => row.file);
    if (count + existing.length + files.length > 1000) { setError('Mỗi đợt tối đa 1000 lần chụp.'); return; }
    if (files.some(file => !['image/png', 'image/jpeg'].includes(file.type) || !file.size || file.size > MAX_WOUND_IMAGE_BYTES)) {
      setError('Mỗi ảnh phải là PNG/JPEG có dữ liệu, tối đa 8 MiB.'); return;
    }
    const added = files.map((file, index) => ({ ...blank('draft-' + ++serial.current, existing.length + index === 0 ? localTime() : ''), file }));
    setRows([...existing, ...added]); setError('');
  }
  async function loadSample() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/wound-demo/day_007_rgb.png');
      if (!response.ok) throw new Error('Không tải được ảnh mẫu.');
      addFiles([new File([await response.blob()], 'synthetic-wound-sample.png', { type: 'image/png' })]);
    } catch (caught) { setError(message(caught)); }
    finally { setBusy(false); }
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (gate.current || busy || mustReload) return;
    gate.current = true; setBusy(true); setError(''); setProgress('Đang kiểm tra ảnh và thời điểm chụp…');
    const token = ++generation.current;
    let active = session;
    let completed = 0;
    try {
      if (!rows.length || rows.some(row => !row.file || !row.capturedAt || !Number.isFinite(new Date(row.capturedAt).getTime()))) throw new Error('Chọn ảnh và ngày/giờ chụp thực cho từng lần.');
      if (rows.some(row => new Date(row.capturedAt).getTime() > Date.now() + 60_000)) throw new Error('Thời điểm chụp không thể ở tương lai.');
      if (rows.some(row => row.scale.trim() && (!Number.isFinite(Number(row.scale)) || Number(row.scale) <= 0 || Number(row.scale) > 100000))) throw new Error('Thước ảnh phải lớn hơn 0, tối đa 100000 pixel/cm; để trống nếu chưa đo.');
      const prepared = await Promise.all(rows.map(async row => {
        const file = row.file!;
        if (!['image/png', 'image/jpeg'].includes(file.type) || !file.size || file.size > MAX_WOUND_IMAGE_BYTES) throw new Error('Chọn PNG/JPEG tối đa 8 MiB cho mỗi ảnh.');
        // SubtleCrypto is unavailable on plain HTTP phone LAN connections. The
        // server still hashes every image and rejects duplicates atomically.
        const hash = globalThis.crypto?.subtle
          ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('')
          : undefined;
        return { ...row, hash };
      }));
      if (!current(token)) return;
      setRows(prepared);
      if (active) { active = await getWoundSession(active.session_id, patient.patient_id); if (!current(token)) return; accept(active); }
      const pending = prepared.filter(row => !active || !alreadySaved(row, active)).sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
      const hashes = pending.map(row => row.hash).filter(Boolean);
      if (new Set(hashes).size !== hashes.length) throw new Error('Có ảnh trùng trong danh sách. Mỗi lần theo dõi cần một ảnh chụp mới.');
      if ((active?.visits.length ?? 0) + pending.length > 1000) throw new Error('Mỗi đợt tối đa 1000 lần chụp.');
      const lastSaved = active ? active.visits.at(-1) : undefined;
      let previous = lastSaved ? Date.parse(lastSaved.timestamp) : -Infinity;
      for (const row of pending) {
        const time = new Date(row.capturedAt).getTime();
        if (time <= previous) throw new Error('Ngày/giờ phải khác nhau và sau lần đã lưu cuối cùng. Nếu đã gửi ảnh trước đó, tải lại để kiểm tra.');
        previous = time;
      }
      setRows(pending);
      if (!pending.length) { setProgress('Các ảnh này đã được lưu.'); return; }
      if (!active) {
        active = await createWoundSession(woundBaseline(patient));
        if (!current(token)) return;
        accept(active);
      }
      const first = active.visits[0];
      const anchorTime = first ? Date.parse(first.timestamp) : new Date(pending[0].capturedAt).getTime();
      const anchorDay = first?.day ?? 0;
      for (const row of pending) {
        const captureTime = new Date(row.capturedAt).getTime();
        const day = anchorDay + (captureTime - anchorTime) / 86_400_000;
        setProgress('Đang lưu & phân tích lần chụp ' + (completed + 1) + '/' + pending.length + '…');
        active = await appendWoundVisit(active.session_id, patient.patient_id, row.file!, day, {
          timestamp: new Date(captureTime).toISOString(), pixelsPerCm: row.scale.trim() ? Number(row.scale) : undefined,
          includePipelineVisuals: developerMode, captureConditionsConsistent: row.consistent,
        });
        if (!current(token)) return;
        completed++; accept(active); setRows(previousRows => previousRows.filter(x => x.id !== row.id));
      }
      const pendingCount = active.visits.filter(visit => visit.analysis_status === 'pending_model').length;
      setProgress('Đã lưu ' + completed + ' ảnh · ' + active.visits.length + ' lần theo dõi trong đợt.' + (pendingCount ? ' Có ' + pendingCount + ' ảnh đang chờ mô hình sẵn sàng.' : ' Phân tích đã hoàn tất.'));
      const listed = await listWoundSessions(patient.patient_id);
      if (current(token)) { setKnown(listed); setRows([blank()]); }
    } catch (caught) {
      if (current(token)) {
        setError((completed ? 'Đã lưu ' + completed + ' ảnh; giữ lại các ảnh chưa gửi. ' : '') + message(caught));
        // A timeout may happen after a commit. Read server state before retrying.
        if (active) setMustReload(true);
        setProgress('');
      }
    } finally { gate.current = false; if (current(token)) setBusy(false); }
  }
  async function confirmDelete() {
    if (!session || !deleteTarget || gate.current) return;
    gate.current = true; setBusy(true); setError('');
    const target = deleteTarget;
    try {
      if (target === 'session') {
        await deleteWoundSession(session.session_id, patient.patient_id);
        remember(''); setKnown(previous => previous.filter(s => s.session_id !== session.session_id));
        newSession(); setProgress('Đã xóa toàn bộ ảnh và dữ liệu của đợt đã chọn. Không thể hoàn tác.');
      } else {
        accept(await deleteWoundVisit(session.session_id, target.visit_id, patient.patient_id));
        setKnown(await listWoundSessions(patient.patient_id));
        setProgress('Đã xóa lần chụp và cập nhật lại chuỗi theo dõi. Không thể hoàn tác.');
      }
      setMustReload(false); setDeleteTarget(null);
    } catch (caught) { setError(message(caught)); setMustReload(true); }
    finally { gate.current = false; setBusy(false); }
  }
  async function retryAnalysis() {
    if (!session || !selectedVisit || busy || gate.current) return;
    gate.current = true; setBusy(true); setError('');
    try {
      const saved = await retryWoundVisit(session.session_id, selectedVisit.visit_id, patient.patient_id);
      setSession(saved); setSelectedBrief(null); setVisitLoading(true);
      setProgress('Đã phân tích ảnh đã lưu; giữ nguyên ngày chụp và hồ sơ nền.');
    } catch (caught) { setError(message(caught) + ' Ảnh gốc vẫn được giữ trong đợt theo dõi.'); }
    finally { gate.current = false; setBusy(false); }
  }
  const brief = selectedBrief ?? (selectedVisit?.visit_id === session?.visits.at(-1)?.visit_id ? session?.brief : null);

  return <div data-testid="multi-visit-workflow" className="space-y-6" aria-busy={busy}>
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-label="Đợt theo dõi đã lưu">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-medium">Đợt theo dõi
          <select className={input} aria-label="Đợt theo dõi" disabled={busy || visitLoading} value={selected} onChange={e => e.target.value ? void restore(e.target.value) : newSession()}>
            <option value="">Đợt mới · cùng một vết thương</option>
            {known.map(s => <option key={s.session_id} value={s.session_id}>{dateLabel(s.created_at)} · {s.visit_count} ảnh · {s.session_id.slice(0, 6)}</option>)}
            {selected && !known.some(s => s.session_id === selected) && <option value={selected}>Đợt hiện tại · {count} ảnh</option>}
          </select>
        </label>
        <Button type="button" variant="outline" className="min-h-11" disabled={busy || mustReload} onClick={newSession}><Plus className="size-4" />Đợt mới</Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void loadSessions(selected)}><RefreshCw className="size-4" />Tải lại đợt</Button>
        {session && <Button type="button" variant="outline" className="min-h-11 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300" disabled={busy} onClick={() => setDeleteTarget('session')}><Trash2 className="size-4" />Xóa đợt</Button>}
      </div>
      <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted-foreground"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" /><span>Kho lưu: SQLite trên máy chủ MediPass. Ảnh và lần chụp được giữ sau khi đóng trang, đổi thiết bị hoặc khởi động lại, cho đến khi bạn xóa. Cùng một vết thương: tiếp tục đợt đang chọn.</span></p>
      {session && <p className="mt-2 break-all text-xs text-muted-foreground">Mã đợt: {session.session_id} · Hồ sơ nền khóa khi bắt đầu · HbA1c {String(session.patient_profile.hba1c_level)}%</p>}
    </section>

    {deleteTarget && <section role="alertdialog" aria-modal="false" aria-labelledby="delete-wound-title" aria-describedby="delete-wound-description" className="rounded-2xl border border-rose-300 bg-rose-50 p-5 dark:border-rose-900 dark:bg-rose-950/30">
      <h2 id="delete-wound-title" className="font-semibold">Xóa {deleteTarget === 'session' ? 'toàn bộ đợt theo dõi?' : 'lần chụp đã chọn?'}</h2>
      <p id="delete-wound-description" className="mt-2 text-sm leading-6">{deleteTarget === 'session' ? 'Toàn bộ ' + count + ' ảnh, phép đo và dữ liệu trong đợt này sẽ bị xóa vĩnh viễn.' : 'Ảnh ngày ' + dateLabel(deleteTarget.timestamp) + ' và dữ liệu phân tích của lần này sẽ bị xóa; các ảnh còn lại được giữ và tính lại.'} Thao tác không thể hoàn tác.</p>
      <div className="mt-4 flex flex-wrap gap-3"><Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setDeleteTarget(null)}>Hủy xóa</Button><Button type="button" className="min-h-11 bg-rose-600 text-white hover:bg-rose-700" disabled={busy} onClick={() => void confirmDelete()}>Xác nhận xóa</Button></div>
    </section>}
    {error && <div role="alert" className="break-words rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm leading-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}{mustReload && <p className="mt-2 font-medium">Bấm “Tải lại đợt” để đối chiếu dữ liệu trước khi gửi tiếp. Ảnh chưa gửi vẫn được giữ trong biểu mẫu.</p>}</div>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <form onSubmit={submit} className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-label="Thêm ảnh theo ngày" data-annotate="wound-capture-form" data-annotation-label="Lưu ảnh theo dõi vết thương">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950"><ImagePlus className="size-5" /></span><h2 className="text-xl font-semibold">Thêm lần theo dõi</h2></div>
        <p className="text-sm leading-6 text-muted-foreground">Một ảnh cũng được phân tích đầy đủ cùng hồ sơ bệnh nền. Ảnh tiếp theo nối vào đợt này để cập nhật tiến triển.</p>
        <fieldset disabled={busy || mustReload || count >= 1000} className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => camera.current?.click()}><Camera className="size-4" />Chụp ảnh</Button>
            <input ref={camera} aria-label="Chụp ảnh bằng camera" type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
            {developerMode && <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => void loadSample()}><FlaskConical className="size-4" />Thử ảnh mẫu</Button>}
          </div>
          <label className="block text-sm font-medium">Chọn một hoặc nhiều ảnh<input aria-label="Chọn một hoặc nhiều ảnh" type="file" multiple accept=".png,.jpg,.jpeg,image/png,image/jpeg" className={input + ' text-sm file:mr-2'} onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} /></label>
          {rows.map((row, index) => <article key={row.id} className="space-y-3 rounded-xl border border-border p-3" data-testid="visit-draft">
            <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Lần chụp {index + 1}</h3><Button type="button" variant="ghost" className="size-11" aria-label={'Bỏ ảnh chưa lưu ' + (index + 1)} onClick={() => setRows(previous => previous.filter(x => x.id !== row.id))}><X className="size-4" /></Button></div>
            {!row.file && <input aria-label={'Ảnh lần chụp ' + (index + 1)} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" className={input + ' text-sm file:mr-2'} onChange={e => update(row.id, { file: e.target.files?.[0] ?? null, hash: undefined })} />}
            {row.file && <><DraftPreview file={row.file} /><p className="break-all text-xs text-muted-foreground">{row.file.name}</p></>}
            <label className="block text-sm font-medium">Ngày & giờ chụp<input aria-label={'Ngày giờ lần chụp ' + (index + 1)} type="datetime-local" step="1" required className={input} value={row.capturedAt} onChange={e => update(row.id, { capturedAt: e.target.value })} /></label>
            <label className="block text-sm text-muted-foreground">Thước ảnh · pixel/cm (tùy chọn)<input aria-label={'Thước ảnh lần chụp ' + (index + 1)} type="number" min="0.000001" max="100000" step="any" className={input} value={row.scale} placeholder="Chưa đo" onChange={e => update(row.id, { scale: e.target.value })} /></label>
            <label className="flex min-h-11 items-start gap-2 text-sm leading-6"><input type="checkbox" checked={row.consistent} className="mt-1 size-4 shrink-0 accent-blue-600" onChange={e => update(row.id, { consistent: e.target.checked })} /><span>Đã giữ cùng khoảng cách, góc chụp và kích thước ảnh giữa các lần.</span></label>
          </article>)}
          <Button type="button" variant="outline" disabled={count + rows.length >= 1000} className="min-h-11 w-full" onClick={() => setRows(previous => [...previous, blank('draft-' + ++serial.current, previous.length ? '' : localTime())])}><Plus className="size-4" />Thêm ảnh khác</Button>
          <p className="text-xs leading-5 text-muted-foreground">PNG/JPEG ≤ 8 MiB/ảnh · tối đa 1000 ảnh/đợt. Với nhiều ảnh, nhập đúng ngày chụp từng ảnh. Chỉ nhập pixel/cm từ thước cùng mặt phẳng trong chính ảnh đó; chưa có thước thì không suy ra cm².</p>
        </fieldset>
        <Button type="submit" disabled={busy || mustReload || !rows.some(row => row.file) || count >= 1000} className={primary + ' w-full'}>{busy && <Loader2 className="size-4 animate-spin" />}{busy ? 'Đang xử lý…' : 'Lưu & phân tích'}</Button>
        <output aria-live="polite" className="block text-sm leading-6 text-muted-foreground">{progress || (busy ? 'Đang đọc dữ liệu đã lưu…' : 'Hồ sơ mẫu · dữ liệu giả lập hoặc đã loại định danh.')}</output>
      </form>
      <section className="min-w-0 space-y-5" aria-label="Kết quả theo dõi vết thương">
        {session && <div className="rounded-2xl border border-border bg-card p-4 sm:p-5" data-testid="saved-visits">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-semibold"><Clock3 className="size-5 text-blue-600" />Dòng thời gian ảnh</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">{count} lần đã lưu</span></div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3">{session.visits.map(visit => <article key={visit.visit_id} className={'min-w-0 overflow-hidden rounded-xl border ' + (selectedVisit?.visit_id === visit.visit_id ? 'border-blue-600 ring-1 ring-blue-600' : 'border-border')}>
            <button type="button" disabled={busy} aria-pressed={selectedVisit?.visit_id === visit.visit_id} aria-label={'Xem lần chụp ' + dateLabel(visit.timestamp)} className="w-full text-left focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => { if (visit.visit_id !== selectedVisitId) { setSelectedVisitId(visit.visit_id); setSelectedBrief(null); setVisitLoading(true); } setError(''); }}>
              <Image unoptimized width={320} height={224} src={woundVisitImageUrl(session.session_id, visit.visit_id, patient.patient_id)} alt={'Ảnh đã lưu ngày ' + visit.day} className="h-28 w-full bg-slate-100 object-contain dark:bg-slate-900" loading="lazy" />
              <div className="p-3"><p className="text-sm font-semibold">Ngày {Number(visit.day.toFixed(3))}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{dateLabel(visit.timestamp)}</p>{visit.analysis_status === 'pending_model' && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Đã lưu · chờ mô hình</p>}</div>
            </button>
            <Button type="button" variant="ghost" className="min-h-11 w-full rounded-none border-t border-border text-rose-700 dark:text-rose-300" disabled={busy} aria-label={'Xóa lần chụp ' + dateLabel(visit.timestamp)} onClick={() => setDeleteTarget(visit)}><Trash2 className="size-3.5" />Xóa ảnh</Button>
          </article>)}</div>
          {count === 0 && <p className="mt-4 text-sm text-muted-foreground">Đợt đã tạo; thêm ảnh đầu tiên để lưu phân tích cùng hồ sơ nền.</p>}
        </div>}
        {selectedVisit?.analysis_status === 'pending_model' && <section data-testid="pending-model-capture" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><h3 className="font-semibold">Ảnh đã lưu · đang chờ mô hình AI</h3><p className="mt-2 text-sm leading-7">Máy chủ chưa có mô hình sẵn sàng để đo ảnh này. Ảnh gốc, ngày chụp và hồ sơ nền đã được giữ; chưa có kết quả phân tích hình ảnh. Khi mô hình sẵn sàng, bấm phân tích lại, không cần tải ảnh lên lần nữa.</p><Button type="button" disabled={busy || visitLoading} variant="outline" className="mt-4 min-h-11" onClick={() => void retryAnalysis()}><RefreshCw className="size-4" />Phân tích lại ảnh đã lưu</Button></section>}
        {visitLoading && <output className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm"><Loader2 className="size-4 animate-spin" />Đang đọc kết quả của lần chụp…</output>}
        {brief && session && selectedVisit && !visitLoading ? <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">Kết quả đến lần chụp {dateLabel(selectedVisit.timestamp)} · {brief.objective_measurements.visits.length} ảnh được đối chiếu</p>
          {renderBrief(brief, { session, visit: selectedVisit, imageUrl: woundVisitImageUrl(session.session_id, selectedVisit.visit_id, patient.patient_id), lockedPatient: lockedProfile(patient, session) })}
        </div> : !visitLoading && <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 px-5 py-12 text-center dark:border-blue-900 dark:bg-blue-950/20"><div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950"><ImagePlus className="size-7" /></div><h2 className="text-xl font-semibold">Bắt đầu từ một bức ảnh</h2><p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">Hệ thống phân tích ảnh đầu tiên cùng HbA1c, đái tháo đường và tình trạng mạch máu đã ghi nhận. Lần chụp sau được lưu vào cùng đợt để theo dõi thay đổi.</p></div>}
      </section>
    </div>
  </div>;
}
