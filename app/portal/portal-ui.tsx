'use client';
import type { ReactNode, InputHTMLAttributes } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store', signal, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Không thể tải dữ liệu. Vui lòng thử lại.');
  return data as T;
}
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="mp-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input className="mp-input" {...props} />; }
export function SectionHeading({ title, note, children }: { title: string; note?: string; children?: ReactNode }) {
  return <div className="mp-section-heading"><div><h2>{title}</h2>{note && <p>{note}</p>}</div>{children}</div>;
}
export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <Button type="button" variant="outline" onClick={onClick}><Plus />{children}</Button>; }
export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) { return <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onClick}><Trash2 className="text-rose-600" /></Button>; }
export function Busy({ label = 'Đang tải hồ sơ…' }: { label?: string }) { return <output className="mp-loading"><Loader2 className="animate-spin" />{label}</output>; }
export function ErrorBox({ message }: { message: string }) { return message ? <div className="mp-error" role="alert">{message}</div> : null; }
export function formatDate(value: string) { return value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Chưa ghi nhận'; }
export function age(dob: string) { const date = new Date(`${dob}T12:00:00`), today = new Date(); return today.getFullYear() - date.getFullYear() - (today.getMonth() < date.getMonth() || (today.getMonth() === date.getMonth() && today.getDate() < date.getDate()) ? 1 : 0); }
export function uid() { return crypto.randomUUID(); }
export const sexLabels: Record<string, string> = { female: 'Nữ', male: 'Nam', other: 'Khác', unspecified: 'Chưa ghi nhận' };
export const medicineLabels: Record<string, string> = { active: 'Đang dùng', completed: 'Đã hoàn tất', stopped: 'Đã ngừng' };
export const severityLabels: Record<string, string> = { unknown: 'Chưa rõ', mild: 'Nhẹ', moderate: 'Vừa', severe: 'Nặng' };
