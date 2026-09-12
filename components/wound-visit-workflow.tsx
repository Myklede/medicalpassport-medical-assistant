'use client';

import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_WOUND_IMAGE_BYTES, type ClinicalBrief } from '@/lib/wound-api';
import { createWoundSession, getWoundSession, appendWoundVisit, WOUND_SESSION_API, type WoundSession } from '@/lib/wound-sessions-api';
import { woundBaseline, type WoundPatient } from '@/lib/wound-patients';

const input = 'mt-2 min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60';
type Draft = { id: string; file: File | null; day: string; scale: string; hash?: string };
const blank = (day: number, id = 'initial'): Draft => ({ id, file: null, day: String(day), scale: '' });
const nextDay = (day: number) => day < 1 ? 1 : day < 3 ? 3 : day < 7 ? 7 : day + 7;
const message = (error: unknown) => error instanceof Error ? error.message : 'Không đọc được dịch vụ theo dõi.';
function alreadySaved(row: Draft, session: WoundSession) {
  return !!row.hash && !!session.brief?.objective_measurements.visits.some(v => v.day === Number(row.day) && v.image_sha256 === row.hash);
}

function DraftPreview({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const src = URL.createObjectURL(file); setUrl(src); return () => URL.revokeObjectURL(src); }, [file]);
  return url ? <img src={url} alt={`Ảnh chờ gửi: ${file.name}`} className="h-32 w-full rounded-lg bg-muted object-contain" /> : null;
}

export default function WoundVisitWorkflow({ patient, developerMode, onBusyChange, renderBrief }: {
  patient: WoundPatient; developerMode: boolean; onBusyChange: (busy: boolean) => void;
  renderBrief: (brief: ClinicalBrief) => ReactNode;
}) {
  const [session, setSession] = useState<WoundSession | null>(null);
  const [selected, setSelected] = useState('');
  const [known, setKnown] = useState<string[]>([]);
  const [rows, setRows] = useState<Draft[]>([blank(1)]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [storageNote, setStorageNote] = useState('');
  const [progress, setProgress] = useState('');
  const [mustReload, setMustReload] = useState(false);
  const generation = useRef(0);
  const serial = useRef(0);
  const alive = useRef(true);
  const gate = useRef(false);
  const key = `medipass-wound-sessions-v1:${patient.patient_id}`;
  const lastDay = session?.visits.at(-1)?.day ?? -1;
  const count = session?.visits.length ?? 0;

  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; onBusyChange(false); }; }, [onBusyChange]);
  useEffect(() => {
    let refs: string[] = [];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(stored)) refs = stored.filter((v): v is string => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v));
    } catch { setStorageNote('Trình duyệt không lưu được mã đợt. Dữ liệu đã gửi vẫn nằm trên máy chủ Python.'); }
    setKnown(refs);
    if (refs[0]) void restore(refs[0]);
    else setBusy(false);
    // The parent remounts this workflow whenever the profile or mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function remember(id: string) {
    setKnown(previous => {
      const refs = [id, ...previous.filter(x => x !== id)];
      try { localStorage.setItem(key, JSON.stringify(refs)); }
      catch { setStorageNote('Không lưu được mã đợt trong trình duyệt. Hãy giữ lại mã đợt hiển thị bên dưới.'); }
      return refs;
    });
  }
  async function restore(id: string, reconcile = false) {
    const token = ++generation.current;
    setSelected(id); setBusy(true); setError('');
    if (!reconcile) { setSession(null); setRows([blank(1)]); }
    try {
      const saved = await getWoundSession(id, patient.patient_id);
      if (!alive.current || token !== generation.current) return;
      setSession(saved); setMustReload(false);
      setRows(previous => reconcile ? previous.filter(row => !alreadySaved(row, saved)) : [blank(nextDay(saved.visits.at(-1)?.day ?? -1))]);
    } catch (caught) {
      if (alive.current && token === generation.current) { setError(message(caught)); setMustReload(true); }
    } finally { if (alive.current && token === generation.current) setBusy(false); }
  }
  function newSession() {
    generation.current++; setSession(null); setSelected(''); setRows([blank(1)]);
    setMustReload(false); setProgress(''); setError('');
  }
  function update(id: string, change: Partial<Draft>) {
    setRows(previous => previous.map(row => row.id === id ? { ...row, ...change } : row)); setError('');
  }
  function addFiles(files: File[]) {
    const existing = rows.filter(row => row.file);
    if (count + existing.length + files.length > 30) { setError('Mỗi đợt tối đa 30 lần chụp.'); return; }
    if (files.some(file => !['image/png', 'image/jpeg'].includes(file.type) || !file.size || file.size > MAX_WOUND_IMAGE_BYTES)) {
      setError('Mỗi ảnh phải là PNG/JPEG có dữ liệu, tối đa 8 MiB.'); return;
    }
    let day = Math.max(lastDay, ...existing.map(row => Number(row.day) || 0));
    const added = files.map(file => { day = nextDay(day); return { ...blank(day, `draft-${++serial.current}`), file }; });
    setRows([...existing, ...added]); setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (gate.current || busy || mustReload) return;
    gate.current = true; setBusy(true); setError(''); setProgress('Kiểm tra ảnh và ngày theo dõi…');
    const token = ++generation.current;
    let active = session;
    let completed = 0;
    try {
      if (!rows.length || rows.some(row => !row.file || !row.day.trim() || !Number.isFinite(Number(row.day)) || Number(row.day) < 0)) throw new Error('Chọn ảnh và nhập ngày hợp lệ cho mỗi lần chụp.');
      if (rows.some(row => row.scale.trim() && (!Number.isFinite(Number(row.scale)) || Number(row.scale) <= 0 || Number(row.scale) > 100000))) throw new Error('Thước ảnh phải lớn hơn 0, tối đa 100000 pixel/cm; để trống nếu chưa đo.');
      const prepared = await Promise.all(rows.map(async row => {
        const file = row.file!;
        if (!['image/png', 'image/jpeg'].includes(file.type) || !file.size || file.size > MAX_WOUND_IMAGE_BYTES) throw new Error('Chọn PNG/JPEG tối đa 8 MiB cho mỗi ảnh.');
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
        return { ...row, hash };
      }));
      if (!alive.current || token !== generation.current) return;
      setRows(prepared);
      // Read before appending, so a refreshed tab or a previously lost response
      // cannot silently upload the same saved visit again.
      if (active) { active = await getWoundSession(active.session_id, patient.patient_id); setSession(active); }
      const pending = prepared.filter(row => !active || !alreadySaved(row, active));
      if (new Set(pending.map(row => row.hash)).size !== pending.length) throw new Error('Có ảnh trùng trong danh sách. Mỗi ngày cần một ảnh chụp mới.');
      if ((active?.visits.length ?? 0) + pending.length > 30) throw new Error('Mỗi đợt tối đa 30 lần chụp.');
      let previous = active?.visits.at(-1)?.day ?? -1;
      for (const row of pending) {
        if (Number(row.day) <= previous) throw new Error('Ngày phải tăng dần, không trùng, và sau lần đã lưu cuối cùng.');
        previous = Number(row.day);
      }
      setRows(pending);
      if (!pending.length) { setProgress('Các ảnh này đã được lưu.'); return; }
      if (!active) {
        active = await createWoundSession(woundBaseline(patient));
        if (!alive.current || token !== generation.current) return;
        setSession(active); setSelected(active.session_id); remember(active.session_id);
      }
      for (const row of pending) {
        setProgress(`Đang lưu ngày ${row.day} · ${completed + 1}/${pending.length}`);
        active = await appendWoundVisit(active.session_id, patient.patient_id, row.file!, Number(row.day), {
          pixelsPerCm: row.scale.trim() ? Number(row.scale) : undefined, includePipelineVisuals: developerMode,
        });
        if (!alive.current || token !== generation.current) return;
        completed++; setSession(active); setRows(previous => previous.filter(x => x.id !== row.id));
      }
      setProgress(`Đã lưu ${completed} ảnh. Có ${active.visits.length} lần theo dõi trong đợt này.`);
    } catch (caught) {
      if (alive.current && token === generation.current) {
        setError(`${completed ? `Đã lưu ${completed} ảnh; giữ lại các ảnh chưa gửi. ` : ''}${message(caught)}`);
        // If an upload timed out, it may already be committed. Reconcile by day
        // AND image hash on reload; never assume a network error rolled it back.
        if (active) setMustReload(true);
        setProgress('');
      }
    } finally { gate.current = false; if (alive.current && token === generation.current) setBusy(false); }
  }

  return <div data-testid="multi-visit-workflow" className="space-y-6" aria-busy={busy}>
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-5">
      <label className="min-w-0 flex-1 text-sm font-medium">Đợt theo dõi<select className={input} aria-label="Đợt theo dõi" disabled={busy} value={selected} onChange={e => e.target.value ? void restore(e.target.value) : newSession()}><option value="">Đợt mới</option>{known.map((id, index) => <option key={id} value={id}>Đợt đã lưu {index + 1} · {id.slice(0, 8)}</option>)}</select></label>
      <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={newSession}><Plus className="size-4" />Đợt mới</Button>
      <Button type="button" variant="outline" className="h-11" disabled={busy || !selected} onClick={() => void restore(selected, true)}><RefreshCw className="size-4" />Tải lại đợt</Button>
      <p className="w-full text-sm text-muted-foreground">Cùng một bệnh nhân, cùng một vết thương · lưu trên máy chạy Python (SQLite).</p>
      {session && <p className="w-full break-all text-sm text-muted-foreground">Mã đợt: {session.session_id}{developerMode ? ` · HbA1c hồ sơ đã khóa: ${String(session.patient_profile.hba1c_level)}%` : ''}</p>}
      {storageNote && <p className="w-full text-sm text-amber-700 dark:text-amber-300">{storageNote}</p>}
    </div>
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <form onSubmit={submit} className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="Thêm ảnh theo ngày">
        <h2 className="text-xl font-semibold">Thêm ảnh theo ngày</h2>
        <p className="text-sm leading-6 text-muted-foreground">Chọn ảnh, kiểm tra nhãn ngày rồi lưu theo thứ tự. Tối đa 30 lần trong một đợt.</p>
        <fieldset disabled={busy || mustReload || count >= 30} className="min-w-0 space-y-4">
          <label className="block text-sm font-medium">Chọn nhiều ảnh<input aria-label="Chọn nhiều ảnh" type="file" multiple accept=".png,.jpg,.jpeg,image/png,image/jpeg" className={`${input} text-sm file:mr-2`} onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }} /></label>
          {rows.map((row, index) => <article key={row.id} className="space-y-3 rounded-xl border border-border p-3" data-testid="visit-draft">
            <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Lần chụp {index + 1}</h3><Button type="button" variant="ghost" size="icon" aria-label={`Bỏ lần chụp ${index + 1}`} onClick={() => setRows(previous => previous.filter(x => x.id !== row.id))}><X className="size-4" /></Button></div>
            <input aria-label={`Ảnh lần chụp ${index + 1}`} type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" className={`${input} text-sm file:mr-2`} onChange={e => update(row.id, { file: e.target.files?.[0] ?? null, hash: undefined })} />
            {row.file && <><DraftPreview file={row.file} /><p className="break-words text-sm text-muted-foreground">{row.file.name}</p></>}
            <label className="block text-sm font-medium">Ngày (Day)<input aria-label={`Ngày lần chụp ${index + 1}`} type="number" min="0" step="any" required className={input} value={row.day} onChange={e => update(row.id, { day: e.target.value })} /></label>
            <label className="block text-sm text-muted-foreground">Thước ảnh · pixel/cm (không bắt buộc)<input aria-label={`Thước ảnh lần chụp ${index + 1}`} type="number" min="0.000001" max="100000" step="any" className={input} value={row.scale} placeholder="Chưa đo" onChange={e => update(row.id, { scale: e.target.value })} /></label>
          </article>)}
          <Button type="button" variant="outline" disabled={count + rows.length >= 30} className="h-11 w-full" onClick={() => setRows(previous => [...previous, blank(nextDay(Math.max(lastDay, ...previous.map(r => Number(r.day) || 0))), `draft-${++serial.current}`)])}><Plus className="size-4" />Thêm lần chụp</Button>
          <p className="text-sm leading-6 text-muted-foreground">Chỉ nhập pixel/cm nếu đã đo thước nằm cùng mặt phẳng vết thương trong chính ảnh đó. Để trống: hệ thống giữ số pixel, không tự suy ra cm². Ngày là mốc tương đối; thời điểm lưu do máy chủ ghi nhận.</p>
        </fieldset>
        {error && <div role="alert" className="break-words rounded-xl border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}{mustReload && <p className="mt-2 font-medium">Bấm “Tải lại đợt” để đối chiếu những ảnh đã lưu trước khi gửi tiếp.</p>}</div>}
        <Button type="submit" disabled={busy || mustReload || !rows.some(row => row.file) || count >= 30} className="h-12 w-full rounded-xl bg-teal-700 text-white hover:bg-teal-800">{busy && <Loader2 className="size-4 animate-spin" />}{busy ? 'Đang xử lý…' : 'Lưu & phân tích các lần chụp'}</Button>
        <p role="status" className="text-sm leading-6 text-muted-foreground">{progress || (busy ? 'Đang đọc đợt theo dõi…' : 'Ảnh đã lưu sẽ xuất hiện bên cạnh.')}</p>
      </form>
      <section className="min-w-0 space-y-5" aria-label="Kết quả theo dõi nhiều ngày">
        {session && <div className="rounded-2xl border border-border bg-card p-5" data-testid="saved-visits">
          <h2 className="text-xl font-semibold">Đã lưu · {count} lần chụp</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{session.visits.map(visit => <article key={visit.visit_id} className="min-w-0 overflow-hidden rounded-xl border border-border">
            <img src={new URL(visit.image_path, WOUND_SESSION_API).href} alt={`Ảnh đã lưu ngày ${visit.day}`} className="h-28 w-full bg-muted object-contain" />
            <div className="p-3"><h3 className="font-semibold">Ngày {visit.day}</h3><p className="mt-1 text-sm text-muted-foreground">{new Date(visit.timestamp).toLocaleString('vi-VN')}</p></div>
          </article>)}</div>
        </div>}
        {session?.brief ? renderBrief(session.brief) : <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><h2 className="text-xl font-semibold">Một vết thương, nhiều lần theo dõi</h2><p className="mt-3 leading-7 text-muted-foreground">Thêm ảnh ngày 1, ngày 3, ngày 7… Sau hai lần chụp, bảng so sánh sẽ hiển thị thay đổi và phần giải thích theo hồ sơ.</p></div>}
      </section>
    </div>
  </div>;
}
