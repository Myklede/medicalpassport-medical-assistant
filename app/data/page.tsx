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
  ['01','Hồ sơ bệnh nhân','mp_portal_patients','Tên, ngày sinh, mã hồ sơ và thông tin liên hệ.'],
  ['02','Bệnh nền chung','mp_patient_conditions','Mỗi bệnh nền gắn với một bệnh nhân, không lặp ở từng lần khám.'],
  ['03','Dị ứng chung','mp_patient_allergies','Chất gây dị ứng, phản ứng và mức độ.'],
  ['04','Bác sĩ','mp_clinicians','Tên, chuyên khoa, cơ sở và thông tin liên hệ công khai.'],
  ['05','Lần khám','mp_encounters','Một dòng cho mỗi buổi khám: triệu chứng, nhận định, kế hoạch và bác sĩ.'],
  ['06','Xét nghiệm','mp_encounter_labs','Tên chuyên môn, kết quả, đơn vị, khoảng tham chiếu và chú giải.'],
  ['07','Thuốc theo lần khám','mp_encounter_medications','Tên thuốc, liều, cách dùng, thời gian và trạng thái.'],
  ['08','Dịch vụ / thủ thuật','mp_encounter_procedures','Những việc đã thực hiện và kết quả.'],
  ['09','Yêu cầu chỉnh sửa','mp_feedback','Góp ý trên web, vị trí, mức ưu tiên và tiến độ.'],
  ['10','Lịch sử lưu','mp_portal_audit','Theo dõi hồ sơ nào được tạo hoặc chỉnh sửa, phiên bản và thời gian.'],
];
export default function DataPage() {
  const [data, setData] = useState<(PortalData & DataSnapshot) | null>(null), [error, setError] = useState(''), [checking, setChecking] = useState(false);
  async function load() { setChecking(true); try { setData(await api<PortalData & DataSnapshot>('/api/portal/data')); setError(''); } catch (e) { setError((e as Error).message); } finally { setChecking(false); } }
  useEffect(() => { void Promise.resolve().then(load); }, []);
  const connected = data?.storage.provider === 'supabase' && !error;
  const projectRef = data?.storage.project_url ? new URL(data.storage.project_url).hostname.split('.')[0] : 'gsllxxdewmksjbcnxgvp';
  return <main className="mp-standalone"><nav className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5 dark:border-slate-800" aria-label="Điều hướng dữ liệu"><Link href="/" className="inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600"><MediPassBrand /></Link><Link className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600 hover:text-blue-600 dark:text-slate-300" href="/editor"><ArrowLeft size={17} />Về cổng bệnh viện</Link></nav><header className="mp-page-heading"><div><p className="mp-eyebrow">NƠI HỒ SƠ ĐƯỢC LƯU</p><h1>Dữ liệu & Supabase</h1><p>Hồ sơ được chia theo bệnh nhân, thông tin chung và từng lần khám.</p></div><Button variant="outline" disabled={checking} onClick={() => void load()}><RefreshCw className={checking ? 'animate-spin' : ''} />Kiểm tra kết nối</Button></header><ErrorBox message={error} />
    <section className={`mp-connection-panel ${connected ? 'connected' : ''}`}><div className="mp-connection-icon">{connected ? <CheckCircle2 /> : <Database />}</div><div><h2>{connected ? 'Đang lưu trực tiếp vào Supabase' : 'Chưa kết nối Supabase'}</h2><p>{connected ? data?.storage.project_url : 'Bản demo hiện lưu dữ liệu vào bộ lưu trữ của app. Chưa có dữ liệu từ portal này được xác nhận đã ghi vào Supabase của bạn.'}</p>{<a className="mp-text-action" href={`https://supabase.com/dashboard/project/${projectRef}/editor`} target="_blank" rel="noreferrer">Mở dự án Supabase của bạn ↗</a>}</div></section>
    <div className="mp-data-flow"><div><Server /><b>Bác sĩ nhập</b><span>Lưu toàn bộ lần khám</span></div><ArrowRight /><div><Database /><b>{connected ? 'Supabase' : 'Bộ lưu demo'}</b><span>Hồ sơ có liên kết, có phiên bản</span></div><ArrowRight /><div><FileText /><b>Bệnh nhân xem</b><span>Cùng dữ liệu, có chú giải</span></div></div>
    {!connected && <section className="mp-panel mp-setup"><h2>Hoàn tất kết nối dự án của bạn</h2><p>Liên kết dashboard không chứa khóa để app ghi dữ liệu. Cần Project URL chính xác và Secret key ở phần cấu hình riêng của máy chủ.</p><ol><li>Mở dự án Supabase cần dùng, vào SQL Editor và chạy file tạo cấu trúc bên dưới.</li><li>Điền <code>SUPABASE_URL</code> và <code>SUPABASE_SECRET_KEY</code> vào <code>.env.local</code> của dự án khi chạy local, hoặc phần biến môi trường của Sites khi chạy trên web.</li><li>Khởi động lại app rồi bấm “Kiểm tra kết nối”. Ở lần kết nối đầu, hồ sơ và góp ý đã lưu trong demo được chuyển sang không gian Supabase mới; nếu chưa có dữ liệu, app tạo năm bệnh nhân mẫu.</li></ol><a className="mp-button" href="/api/portal/schema"><Download size={16} />Tải cấu trúc Supabase (.sql)</a><p className="mp-footnote">Chỉ cấu hình khóa bí mật phía máy chủ. Bản demo gốc được giữ lại. Không ghi đè không gian Supabase đã có dữ liệu.</p></section>}
    {data && !error && <DataExplorer data={data} />}
    <details className="mp-panel"><summary>Cấu trúc các nhóm dữ liệu trong Supabase</summary><div className="mp-schema-list">{tables.map(([number,label,table,detail]) => <article key={table}><span className="mp-schema-number">{number}</span><div><h3>{label}</h3><p>{detail}</p></div><code>{table}</code>{connected && <a href={`https://supabase.com/dashboard/project/${projectRef}/editor`} target="_blank" rel="noreferrer" aria-label={`Mở nhóm ${label}`}>↗</a>}</article>)}</div></details><p className="mp-footnote">Bảng mới dùng tiền tố mp_. Các bảng hồ sơ từ bản demo trước vẫn được giữ nguyên và truy cập ở “Hồ sơ trước đây”.</p>
  </main>;
}
