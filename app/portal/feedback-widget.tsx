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
  function close() { if (!saving && (!draft?.description || window.confirm('Góp ý chưa được gửi. Đóng và bỏ nội dung đang nhập?'))) setDraft(null); }
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draft) return; setSaving(true); setError('');
    try { await api('/api/feedback', draft); setDraft(null); setSuccess('Đã lưu yêu cầu chỉnh sửa.'); window.dispatchEvent(new Event('medipass-feedback-saved')); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <><div className="mp-feedback-float mp-no-print">{success && <output className="mp-feedback-toast">{success} <Link href="/feedback">Xem danh sách</Link><button onClick={() => setSuccess('')} aria-label="Đóng thông báo">×</button></output>}<Button size="lg" className="mp-feedback-button" onClick={() => open()}><MessageSquare />Góp ý chỉnh sửa</Button></div>{draft && <Dialog open onOpenChange={value => { if (!value) close(); }}><DialogContent className="mp-form-dialog sm:max-w-[620px]" showCloseButton={!saving}><DialogTitle>Bạn muốn chỉnh sửa gì?</DialogTitle><DialogDescription>Ghi từng yêu cầu, kèm vị trí trên trang. Các góp ý được lưu vào danh sách để cùng rà soát ở phiên làm việc tiếp theo.</DialogDescription><form onSubmit={submit}><fieldset disabled={saving}><Field label="Tiêu đề ngắn *"><Input required maxLength={160} placeholder="VD: Thu gọn phần thông tin bác sĩ" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></Field><div className="mp-form-grid"><Field label="Loại góp ý"><select className="mp-input" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{Object.entries(feedbackCategories).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Mức ưu tiên"><select className="mp-input" value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value })}><option value="normal">Bình thường</option><option value="high">Cần xử lý sớm</option></select></Field></div><Field label="Khu vực muốn chỉnh"><Input placeholder="VD: thẻ xét nghiệm, thanh bên, danh sách bệnh nhân…" value={draft.section} onChange={e => setDraft({ ...draft, section: e.target.value })} /></Field><Field label="Mô tả yêu cầu *"><textarea className="mp-input" required rows={5} maxLength={8000} placeholder="Chỗ nào chưa thuận tiện? Bạn muốn nó thay đổi thế nào?" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></Field><p className="mp-footnote">Vị trí được lưu: {draft.page_path}</p></fieldset><ErrorBox message={error} /><div className="mp-form-footer"><Link href="/feedback">Xem các yêu cầu đã gửi</Link><Button type="submit" disabled={saving}><Send />{saving ? 'Đang gửi…' : 'Lưu yêu cầu'}</Button></div></form></DialogContent></Dialog>}</>;
}
