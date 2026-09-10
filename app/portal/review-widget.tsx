'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from '@/components/app-link';
import { MessageSquare, MousePointer2, Send, Smartphone, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { feedbackStatuses, type Feedback } from '@/lib/portal-types';
import { api, ErrorBox, Field, Input, uid } from './portal-ui';

type Box = { left: number; top: number; width: number; height: number };
type Pin = { request: Feedback; left: number; top: number; anchorLeft: number; anchorTop: number; number: number };
const ignored = '[data-annotation-ui], [data-slot="dialog-content"], [data-slot="dialog-overlay"]';

function selectorFor(element: Element): string {
  if (element.hasAttribute('data-annotate')) return `[data-annotate="${CSS.escape(element.getAttribute('data-annotate')!)}"]`;
  if (element.id) return `#${CSS.escape(element.id)}`;
  const parts: string[] = [];
  for (let node: Element | null = element; node && node.tagName !== 'BODY'; node = node.parentElement) {
    if (node.hasAttribute('data-annotate')) { parts.unshift(`[data-annotate="${CSS.escape(node.getAttribute('data-annotate')!)}"]`); break; }
    const siblings = node.parentElement ? Array.from(node.parentElement.children).filter(s => s.tagName === node!.tagName) : [node];
    parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
  }
  return parts.join(' > ');
}
function targetFrom(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element) || node.closest(ignored)) return null;
  return node.closest<HTMLElement>('[data-annotate]') || node.closest<HTMLElement>('article, section, nav, header, aside, label, button, a, p, h1, h2, h3');
}
function requestMatches(request: Feedback) {
  const url = new URL(request.page_path || '/', window.location.origin);
  return url.pathname === window.location.pathname && (!request.patient_id || request.patient_id === new URLSearchParams(window.location.search).get('patient'));
}
function locate(request: Feedback): HTMLElement | null {
  if (!request.annotation) return null;
  try { return document.querySelector<HTMLElement>(request.annotation.selector); } catch { return null; }
}

export function FeedbackWidget() {
  const [enabled, setEnabled] = useState(false), [embedded, setEmbedded] = useState(true), [mobileShell, setMobileShell] = useState(false);
  const [draft, setDraft] = useState<Feedback | null>(null), [saving, setSaving] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const [requests, setRequests] = useState<Feedback[]>([]), [pins, setPins] = useState<Pin[]>([]), [box, setBox] = useState<Box | null>(null), [listOpen, setListOpen] = useState(false);
  const hovered = useRef<HTMLElement | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reload = useCallback(async () => { try { const result = await api<{ requests: Feedback[] }>('/api/feedback'); setRequests(result.requests); setError(''); } catch (e) { setError((e as Error).message); } }, []);

  function open(context: Partial<Feedback> = {}) {
    setError(''); setSuccess(''); setBox(null);
    setDraft({ id: uid(), version: 0, title: '', description: '', category: 'interface', priority: 'normal', status: 'open', page_path: window.location.pathname + window.location.search, section: '', patient_id: new URLSearchParams(window.location.search).get('patient') || '', encounter_id: '', resolution: '', created_at: '', updated_at: '', ...context });
  }
  function reveal(request: Feedback) {
    setDraft(request); setError('');
    if (revealTimer.current) clearTimeout(revealTimer.current);
    let attempts = 0;
    const find = () => {
      const target = locate(request);
      if (target?.getClientRects().length) { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      window.dispatchEvent(new CustomEvent('medipass-reveal', { detail: { encounter_id: request.encounter_id, selector: request.annotation?.selector } }));
      if (++attempts < 30) revealTimer.current = setTimeout(find, 200);
    };
    find();
  }
  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);
  function toggleMode() {
    const next = !enabled;
    setEnabled(next); setListOpen(false);
    const url = new URL(window.location.href);
    if (next) { url.searchParams.set('annotate', '1'); void reload(); } else url.searchParams.delete('annotate');
    window.history.replaceState(window.history.state, '', url);
  }
  useEffect(() => {
    setEmbedded(window.self !== window.top);
    setMobileShell(window.location.pathname === '/mobile');
    const query = new URLSearchParams(window.location.search);
    if (query.get('annotate') === '1' || query.has('review')) { setEnabled(true); void reload(); }
    const handler = (event: Event) => { setEnabled(true); open((event as CustomEvent<Partial<Feedback>>).detail ?? {}); };
    window.addEventListener('medipass-feedback', handler);
    window.addEventListener('medipass-feedback-saved', reload);
    return () => { window.removeEventListener('medipass-feedback', handler); window.removeEventListener('medipass-feedback-saved', reload); };
  }, [reload]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('review');
    const request = requests.find(r => r.id === id);
    if (request && !draft) { reveal(request); const url = new URL(window.location.href); url.searchParams.delete('review'); window.history.replaceState(window.history.state, '', url); }
  }, [requests]);

  useEffect(() => {
    if (!enabled || draft) { setBox(null); return; }
    document.body.classList.add('mp-annotation-mode');
    const move = (event: MouseEvent) => {
      hovered.current = targetFrom(event.target);
      const rect = hovered.current?.getBoundingClientRect();
      setBox(rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null);
    };
    const down = (event: PointerEvent) => { if (targetFrom(event.target) && event.button === 0) { event.preventDefault(); event.stopImmediatePropagation(); } };
    const select = (event: MouseEvent) => {
      const target = targetFrom(event.target);
      if (!target || event.button !== 0) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const rect = target.getBoundingClientRect();
      const quote = (target.innerText || target.getAttribute('aria-label') || target.tagName).trim().replace(/\s+/g, ' ').slice(0,500);
      const label = target.dataset.annotationLabel || quote.slice(0,120);
      open({ title: label, section: label.slice(0,200), encounter_id: target.closest<HTMLElement>('[data-encounter-id]')?.dataset.encounterId || '', annotation: { selector: selectorFor(target), quote, x: Math.min(1,Math.max(0,(event.clientX - rect.left) / Math.max(rect.width,1))), y: Math.min(1,Math.max(0,(event.clientY - rect.top) / Math.max(rect.height,1))), viewport_width: window.innerWidth, viewport_height: window.innerHeight } });
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEnabled(false); setListOpen(false);
        const url = new URL(window.location.href); url.searchParams.delete('annotate');
        window.history.replaceState(window.history.state, '', url);
      }
    };
    document.addEventListener('mousemove', move, true); document.addEventListener('pointerdown', down, true); document.addEventListener('click', select, true); document.addEventListener('keydown', escape);
    return () => { document.body.classList.remove('mp-annotation-mode'); document.removeEventListener('mousemove', move, true); document.removeEventListener('pointerdown', down, true); document.removeEventListener('click', select, true); document.removeEventListener('keydown', escape); };
  }, [enabled, draft]);

  useEffect(() => {
    if (!enabled) { setPins([]); return; }
    let frame = 0;
    const position = () => {
      frame = 0;
      const visible = requests.filter(r => r.annotation && r.status !== 'done' && requestMatches(r));
      const positioned: Pin[] = [];
      visible.forEach((request, i) => {
        const target = locate(request), rect = target?.getBoundingClientRect();
        if (!target?.getClientRects().length || !rect) return;
        const anchorLeft = rect.left + rect.width * request.annotation!.x;
        const anchorTop = rect.top + rect.height * request.annotation!.y;
        const origin = Math.min(window.innerWidth - 18, Math.max(18, anchorLeft));
        // Fan nearby pins out on a 36px grid so every comment remains clickable.
        // Keep the original anchor to draw a leader back to the selected spot.
        for (let radius = 0; radius <= visible.length; radius++) {
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
              const left = origin + dx * 36, top = anchorTop + dy * 36;
              if (left < 18 || left > window.innerWidth - 18) continue;
              if (positioned.some(p => Math.abs(p.left - left) < 34 && Math.abs(p.top - top) < 34)) continue;
              positioned.push({ request, number: i + 1, left, top, anchorLeft, anchorTop });
              return;
            }
          }
        }
      });
      setPins(positioned);
      const rect = hovered.current?.getBoundingClientRect();
      if (rect && !draft) setBox({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(position); };
    const observer = new MutationObserver(mutations => { if (mutations.some(m => m.target instanceof Element && !m.target.closest('[data-annotation-ui]'))) schedule(); });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', schedule, true); window.addEventListener('resize', schedule); schedule();
    return () => { observer.disconnect(); window.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame); };
  }, [enabled, requests, draft]);

  function close() { if (!saving && (!draft?.description || draft.version > 0 || window.confirm('Bình luận chưa được lưu. Bỏ nội dung đang nhập?'))) setDraft(null); }
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draft) return; setSaving(true); setError('');
    try { const result = await api<{ request: Feedback }>('/api/feedback', draft); setRequests(old => [...old.filter(r => r.id !== result.request.id), result.request]); setDraft(null); setSuccess('Đã ghim bình luận tại vị trí bạn chọn.'); window.dispatchEvent(new Event('medipass-feedback-saved')); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  if (mobileShell) return null;
  return <>
    <div data-annotation-ui className="mp-review-tools mp-no-print">
      {success && <output className="mp-feedback-toast">{success}<button onClick={() => setSuccess('')} aria-label="Ẩn thông báo"><X size={16} /></button></output>}
      {enabled && <div className="mp-review-hint"><b>Chọn vị trí cần chỉnh sửa</b><span>Di chuột để xem viền, bấm để ghim bình luận. Tắt chế độ để dùng các nút bình thường.</span><ErrorBox message={error} /></div>}
      <div className="mp-review-toolbar">
        {!embedded && <Button variant="outline" onClick={() => window.location.assign(`/mobile?path=${encodeURIComponent(window.location.pathname + window.location.search)}`)}><Smartphone />Giao diện điện thoại</Button>}
        <Button aria-pressed={enabled} onClick={toggleMode}><MousePointer2 />{enabled ? 'Tắt chú thích' : 'Chú thích giao diện'}</Button>
        {enabled && <Button variant="outline" onClick={() => setListOpen(!listOpen)} aria-expanded={listOpen}><MessageSquare />Bình luận ({requests.filter(r => r.status !== 'done' && requestMatches(r)).length})</Button>}
      </div>
      {enabled && listOpen && <aside className="mp-review-list"><strong>Bình luận trên trang này</strong>{requests.filter(requestMatches).map(r => <button key={r.id} onClick={() => reveal(r)}><b>{r.section || r.title}</b><span>{r.description}</span><small>{feedbackStatuses[r.status as keyof typeof feedbackStatuses]}</small></button>)}<Link href="/feedback">Xem tất cả yêu cầu ↗</Link></aside>}
    </div>
    {enabled && !draft && box && <div data-annotation-ui className="mp-annotation-outline" style={box} />}
    {enabled && !draft && <svg data-annotation-ui className="mp-annotation-leaders mp-no-print" aria-hidden="true">{pins.map(pin => <line key={pin.request.id} x1={pin.anchorLeft} y1={pin.anchorTop} x2={pin.left} y2={pin.top} />)}</svg>}
    {enabled && !draft && pins.map(pin => <button data-annotation-ui className="mp-annotation-pin mp-no-print" key={pin.request.id} style={{ left: pin.left, top: pin.top }} onClick={() => reveal(pin.request)} aria-label={`Mở bình luận ${pin.number}: ${pin.request.title}`} title={pin.request.description}>{pin.number}</button>)}
    {draft && <Dialog open onOpenChange={value => { if (!value) close(); }}><DialogContent data-annotation-ui className="mp-form-dialog sm:max-w-[620px]" showCloseButton={!saving}><DialogTitle>{draft.version ? 'Bình luận đã ghim' : 'Ghim bình luận tại đây'}</DialogTitle><DialogDescription>{draft.section || 'Ghi yêu cầu chỉnh sửa cho trang này.'}</DialogDescription><form onSubmit={submit}><fieldset disabled={saving}>
      {draft.annotation && <blockquote className="mp-selected-quote">{draft.annotation.quote.slice(0,250)}</blockquote>}
      {!draft.annotation && <Field label="Vị trí / tiêu đề"><Input required maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></Field>}
      <Field label="Bạn muốn chỉnh sửa thế nào?"><textarea autoFocus className="mp-input" required rows={5} maxLength={8000} placeholder="Ví dụ: Thu gọn thẻ này, đặt ngày khám và bác sĩ cùng một dòng…" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Field>
      <Field label="Mức ưu tiên"><select className="mp-input" value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })}><option value="normal">Bình thường</option><option value="high">Cần xử lý sớm</option></select></Field>
      {draft.resolution && <p className="mp-clinician-note">Phản hồi: {draft.resolution}</p>}
      <p className="mp-footnote">{draft.page_path} · {draft.annotation ? `Ghim ở giao diện ${draft.annotation.viewport_width}px` : 'Bình luận chung'}</p>
    </fieldset><ErrorBox message={error} /><div className="mp-form-footer"><Button type="button" variant="outline" disabled={saving} onClick={close}>Đóng</Button><Button type="submit" disabled={saving}><Send />{saving ? 'Đang lưu…' : 'Lưu bình luận'}</Button></div></form></DialogContent></Dialog>}
  </>;
}
