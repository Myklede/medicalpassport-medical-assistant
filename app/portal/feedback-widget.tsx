'use client';
import { useEffect, useState } from 'react';
import Link from '@/components/app-link';
import { MessageSquare, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { feedbackCategories, type Feedback } from '@/lib/portal-types';
import { api, ErrorBox, Field, Input, uid } from './portal-ui';

export function FeedbackWidget() {
  const [draft, setDraft] = useState<Feedback | null>(null), [saving, setSaving] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  function open(context: Partial<Feedback> = {}) {
    setError(''); setSuccess('');
    setDraft({ id: uid(), version: 0, title: '', description: '', category: 'interface', priority: 'normal', status: 'open', page_path: window.location.pathname + window.location.search, section: '', patient_id: new URLSearchParams(window.location.search).get('patient') || '', encounter_id: '', resolution: '', created_at: '', updated_at: '', ...context });
  }
  useEffect(() => {
    const handler = (event: Event) => open((event as CustomEvent<Partial<Feedback>>).detail ?? {});
    window.addEventListener('medipass-feedback', handler); return () => window.removeEventListener('medipass-feedback', handler);
  }, []);
  function close() { if (!saving && (!draft?.description || window.confirm('This feedback has not been submitted. Close and discard it?'))) setDraft(null); }
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draft) return; setSaving(true); setError('');
    try { await api('/api/feedback', draft); setDraft(null); setSuccess('Change request saved.'); window.dispatchEvent(new Event('medipass-feedback-saved')); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <><div className="mp-feedback-float mp-no-print">{success && <output className="mp-feedback-toast">{success} <Link href="/feedback">View list</Link><button onClick={() => setSuccess('')} aria-label="Dismiss notification">×</button></output>}<Button size="lg" className="mp-feedback-button" onClick={() => open()}><MessageSquare />Request a change</Button></div>{draft && <Dialog open onOpenChange={value => { if (!value) close(); }}><DialogContent className="mp-form-dialog sm:max-w-[620px]" showCloseButton={!saving}><DialogTitle>What would you like to change?</DialogTitle><DialogDescription>Describe one request and its location on the page. Requests are saved in a list for review during the next work session.</DialogDescription><form onSubmit={submit}><fieldset disabled={saving}><Field label="Short title *"><Input required maxLength={160} placeholder="Example: Condense clinician information" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></Field><div className="mp-form-grid"><Field label="Feedback type"><select className="mp-input" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{Object.entries(feedbackCategories).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Priority"><select className="mp-input" value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })}><option value="normal">Normal</option><option value="high">Needs attention soon</option></select></Field></div><Field label="Area to change"><Input placeholder="Example: lab card, sidebar, patient list…" value={draft.section} onChange={e => setDraft({ ...draft, section: e.target.value })} /></Field><Field label="Request details *"><textarea className="mp-input" required rows={5} maxLength={8000} placeholder="What is difficult to use? How should it change?" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Field><p className="mp-footnote">Saved location: {draft.page_path}</p></fieldset><ErrorBox message={error} /><div className="mp-form-footer"><Link href="/feedback">View submitted requests</Link><Button type="submit" disabled={saving}><Send />{saving ? 'Submitting…' : 'Save request'}</Button></div></form></DialogContent></Dialog>}</>;
}
