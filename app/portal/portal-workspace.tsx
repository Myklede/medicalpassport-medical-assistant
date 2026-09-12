'use client';
/* eslint-disable next/no-html-link-for-pages -- Sites sign-in is a dispatcher-owned top-level navigation. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/app-link';
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
    setSelectedId(saved.id); setEditPatient(null); setNotice(data?.storage.provider === 'supabase' ? 'Đã lưu hồ sơ chung vào Supabase.' : 'Đã lưu vào bộ lưu demo. CHƯA ghi vào Supabase của bạn.');
  }
  function encounterSaved(saved: Encounter) {
    ++visitRequest.current; syncChannel.current?.postMessage('changed');
    setEncounters(old => [...old.filter(e => e.id !== saved.id), saved].sort((a,b) => b.visit_date.localeCompare(a.visit_date) || b.created_at.localeCompare(a.created_at)));
    setExpanded(saved.id); setEditEncounter(null); setTab('visits'); setNotice(data?.storage.provider === 'supabase' ? 'Đã lưu toàn bộ lần khám vào Supabase. Góc nhìn bệnh nhân đã cập nhật.' : 'Đã lưu lần khám trong demo. CHƯA ghi vào Supabase của bạn.'); void load();
  }
  return <div className={`mp-app ${hospital ? 'mp-hospital' : 'mp-patient'}`}>
    <aside className="mp-rail"><Link className="mp-logo" href="/"><span><HeartPulse /></span>MediPass</Link><p className="mp-rail-label">KHÔNG GIAN CHĂM SÓC</p><nav><Link href="/editor" className={hospital ? 'active' : ''}><Stethoscope />Cổng bệnh viện</Link><Link href={selectedId ? `/patient?patient=${selectedId}` : '/patient'} className={!hospital ? 'active' : ''}><FileHeart />Góc nhìn bệnh nhân</Link><Link href="/feedback"><MessageSquare />Yêu cầu chỉnh sửa</Link><Link href="/data"><Database />Dữ liệu & Supabase</Link></nav><div className="mp-rail-divider" /><p className="mp-rail-label">CÔNG CỤ KHÁC</p><nav><Link href="/records"><History />Hồ sơ trước đây</Link><Link href="/insurance"><ShieldCheck />Kiểm tra bảo hiểm</Link><Link href="/medications"><Pill />Đối chiếu thuốc</Link><Link href="/wounds"><Activity />Wound Lab</Link><Link href="/therapy"><HeartPulse />Motion Lab</Link></nav><div className="mp-rail-bottom"><ShieldCheck /><div><strong>Không gian demo riêng</strong><p>Bệnh nhân & bác sĩ giả lập</p></div></div></aside>
    <div className="mp-surface"><header className="mp-topbar"><div><p className="mp-eyebrow">{hospital ? 'DÀNH CHO NHÂN VIÊN Y TẾ' : 'HỒ SƠ CỦA BẠN'}</p><h1>{hospital ? 'Cổng bệnh viện' : 'Sổ sức khỏe'}</h1></div><div className="mp-top-actions"><Link className={`mp-storage-pill ${data?.storage.provider === 'supabase' ? 'connected' : ''}`} href="/data"><span />{data?.storage.provider === 'supabase' ? 'Supabase đã kết nối' : 'Demo · chờ Supabase'}</Link><Button variant="outline" onClick={() => void refresh()} aria-label="Làm mới hồ sơ"><RefreshCw /></Button><Link className="mp-button" href={`${hospital ? '/patient' : '/editor'}${selectedId ? `?patient=${selectedId}` : ''}`}><ArrowLeftRight size={16} />{hospital ? 'Xem phía bệnh nhân' : 'Vào cổng bệnh viện'}</Link></div></header>
    <div className="mp-demo-strip"><span className="mp-demo-dot" />Mô phỏng {data?.patients.length ?? 5} bệnh nhân · cùng một hồ sơ cho hai góc nhìn<span className="mp-strip-right">Dữ liệu giả để thử nhập, chỉnh sửa và xem hồ sơ</span></div>
    <nav className="mp-mobile-links" aria-label="Trang dữ liệu, góp ý và công cụ"><Link href="/data"><Database size={16} />Dữ liệu & Supabase</Link><Link href="/feedback"><MessageSquare size={16} />Yêu cầu chỉnh sửa</Link><Link href="/records"><History size={16} />Hồ sơ trước đây</Link><Link href="/insurance"><ShieldCheck size={16} />Kiểm tra bảo hiểm</Link><Link href="/medications"><Pill size={16} />Đối chiếu thuốc</Link><Link href="/wounds"><Activity size={16} />Wound Lab</Link><Link href="/therapy"><HeartPulse size={16} />Motion Lab</Link></nav>
    {data && data.storage.provider !== 'supabase' && <output className="mp-storage-warning">Hồ sơ đang ở bộ lưu demo, chưa được ghi vào Supabase. <Link href="/data">Hoàn tất kết nối dự án của bạn ↗</Link></output>}<ErrorBox message={error} />{error && <div className="mp-recovery"><Button variant="outline" onClick={() => void load()}>Thử lại</Button><a href="/signin-with-chatgpt?return_to=/editor" target="_top">Đăng nhập để mở demo</a><Link href="/data">Xem kết nối dữ liệu</Link></div>}
    {loading ? <Busy /> : data && <div className="mp-workspace"><aside className="mp-roster"><div className="mp-roster-title"><h2><Users size={18} />Bệnh nhân <span>{data.patients.length}</span></h2>{hospital && <Button size="icon" variant="outline" onClick={() => setEditPatient(blankPatient())} aria-label="Thêm bệnh nhân"><Plus /></Button>}</div><label className="mp-search"><Search size={17} /><input aria-label="Tìm bệnh nhân" placeholder="Tên hoặc mã hồ sơ…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button onClick={() => setSearch('')} aria-label="Xóa tìm kiếm"><X size={14} /></button>}</label><div className="mp-patient-list">{patients.map((p,i) => <button key={p.id} className={`mp-patient-row ${p.id === selectedId ? 'selected' : ''}`} onClick={() => select(p.id)} aria-pressed={p.id === selectedId}><span className={`mp-avatar color-${i%5}`}>{p.display_name.split(' ').slice(-2).map(n => n[0]).join('')}</span><span className="mp-patient-row-text"><strong>{p.display_name}</strong><small>{p.medical_record_number} · {age(p.birth_date)} tuổi</small><span>{p.conditions[0]?.name || 'Chưa ghi nhận bệnh nền'}</span></span><ChevronRight size={16} /></button>)}</div>{patients.length === 0 && <p className="mp-empty-inline">Không tìm thấy bệnh nhân.</p>}<div className="mp-roster-note"><Users size={17} /><p>{hospital ? 'Chọn bệnh nhân để nhập hoặc cập nhật lần khám.' : 'Chọn một người để mô phỏng góc nhìn bệnh nhân đó.'}</p></div></aside>
    <main className="mp-record"><div className="mp-breadcrumb">{hospital ? 'Danh sách bệnh nhân' : 'Góc nhìn bệnh nhân'}<ChevronRight size={13} />{patient?.medical_record_number || 'Hồ sơ'}</div>{notice && <output className="mp-success">{notice}<button aria-label="Ẩn thông báo" onClick={() => setNotice('')}><X size={16} /></button></output>}
      {patient ? <><section data-annotate="patient-heading" data-annotation-label="Thông tin bệnh nhân" className="mp-patient-heading"><div><p className="mp-eyebrow">{hospital ? 'HỒ SƠ BỆNH NHÂN' : 'THÔNG TIN SỨC KHỎE'}</p><h2>{patient.display_name}</h2><p>{sexLabels[patient.sex]} <span>·</span> {age(patient.birth_date)} tuổi <span>·</span> {formatDate(patient.birth_date)} <span>·</span> Nhóm máu {patient.blood_type || 'chưa rõ'}</p></div><div className="mp-patient-heading-actions"><IpsExportDialog patient={patient} encounters={encounters} storage={data.storage} />{hospital && <Button variant="outline" onClick={() => setEditPatient(patient)}><Pencil />Sửa thông tin chung</Button>}</div></section>
      <div className="mp-summary-line"><span><FileText />{encounters.length} lần khám</span><span><Pill />{medicines.length} thuốc ghi nhận đang dùng</span><span><History />Gần nhất: {encounters[0] ? formatDate(encounters[0].visit_date) : 'Chưa có'}</span></div>
      <div className="mp-shared-panels"><section data-annotate="patient-conditions" data-annotation-label="Bệnh nền và tiền sử" className="mp-baseline"><div className="mp-panel-label"><FileHeart size={17} />Bệnh nền & tiền sử chung</div>{patient.conditions.length ? patient.conditions.map(c => <ConditionSummary key={c.id} condition={c} educationOpen={!hospital} />) : <p className="mp-muted">Chưa ghi nhận bệnh nền.</p>}</section><section data-annotate="patient-allergies" data-annotation-label="Dị ứng" className={`mp-baseline ${patient.allergies.length ? 'mp-allergy-panel' : ''}`}><div className="mp-panel-label"><ShieldCheck size={17} />Dị ứng cần lưu ý</div>{patient.allergies.length ? patient.allergies.map(a => <div key={a.id}><strong>{a.substance}</strong><p>{a.reaction || 'Chưa ghi phản ứng'} · {severityLabels[a.severity]}</p>{a.note && <p className="mp-preserve">{a.note}</p>}</div>) : <p className="mp-muted">Chưa có dị ứng được ghi nhận trong hồ sơ.</p>}</section></div>
      <Tabs value={tab} onValueChange={v => setTab(String(v))}><TabsList variant="line" className="mp-record-tabs"><TabsTrigger value="visits">Lịch sử khám</TabsTrigger><TabsTrigger value="medicines">Thuốc đang dùng</TabsTrigger><TabsTrigger value="profile">Thông tin chung</TabsTrigger></TabsList>
        <TabsContent value="visits"><SectionHeading title="Mỗi lần khám, một hồ sơ" note="Mở từng lần khám để xem đầy đủ xét nghiệm, thuốc và hướng dẫn.">{hospital && <Button size="lg" onClick={() => setEditEncounter(blankEncounter(patient, data.clinicians[0]))}><ClipboardPlus />Thêm lần khám</Button>}</SectionHeading>
          {encounters.length > 2 && <label className="mp-search mp-visit-search"><Search size={16} /><input aria-label="Tìm lần khám" placeholder="Tìm lý do khám, bác sĩ hoặc ngày…" value={visitSearch} onChange={e => setVisitSearch(e.target.value)} /></label>}
          <ErrorBox message={visitError} />{visitsLoading ? <Busy label="Đang tải các lần khám…" /> : filteredVisits.length ? <div className="mp-timeline">{filteredVisits.map((e, i) => <article data-annotate={`visit-${e.id}`} data-encounter-id={e.id} data-annotation-label={`Thẻ lần khám: ${e.reason}`} className={`mp-visit-card ${expanded === e.id ? 'open' : ''}`} key={e.id}><div className="mp-visit-heading"><button className="mp-visit-toggle" onClick={() => setExpanded(expanded === e.id ? null : e.id)} aria-expanded={expanded === e.id} aria-controls={`visit-body-${e.id}`}><span className="mp-date-box"><strong>{e.visit_date.slice(8,10)}</strong><span>TH{e.visit_date.slice(5,7)} · {e.visit_date.slice(0,4)}</span></span><span className="mp-visit-title"><span className="mp-visit-meta">{i === 0 && !visitSearch ? <b>LẦN KHÁM GẦN NHẤT</b> : 'HỒ SƠ LẦN KHÁM'}<span>{e.clinician.specialty}</span></span><strong>{e.reason}</strong><span>{e.clinician.name} · {e.clinician.facility}</span></span><ChevronDown className={expanded === e.id ? 'mp-rotate' : ''} size={18} /></button></div><div className="mp-visit-toolbar"><div className="mp-mini-counts"><span><FlaskIcon />{e.labs.length} xét nghiệm</span><span><Pill size={14} />{e.medications.length} thuốc</span><span>{e.procedures.length} dịch vụ</span></div><div><Link href={`/visit/${e.id}?patient=${patient.id}`} className="mp-text-action"><Printer size={15} />Bản đầy đủ / in</Link>{hospital && <Button variant="ghost" onClick={() => setEditEncounter(e)}><Pencil />Sửa</Button>}<button className="mp-text-action" onClick={() => window.dispatchEvent(new CustomEvent('medipass-feedback', { detail: { section: `Lần khám: ${e.reason}`, patient_id: patient.id, encounter_id: e.id } }))} aria-label="Góp ý về lần khám"><MessageSquare size={15} /></button></div></div>{expanded === e.id && <div id={`visit-body-${e.id}`}><EncounterDetail encounter={e} /></div>}</article>)}</div> : <div className="mp-empty-card"><FileText /><h3>{visitSearch ? 'Không tìm thấy lần khám' : 'Chưa có lần khám nào'}</h3><p>{visitSearch ? 'Thử tìm bằng từ khóa khác.' : 'Thêm lần khám đầu tiên từ cổng bệnh viện.'}</p></div>}
        </TabsContent>
        <TabsContent value="medicines"><SectionHeading title="Thuốc ghi nhận đang dùng" note="Tổng hợp theo trạng thái ở lần khám gần nhất cho cùng tên thuốc, liều và đường dùng." /><div className="mp-med-list mp-panel">{medicines.length ? medicines.map(m => <article key={`${m.name}-${m.dose}-${m.route}`}><div><h4>{m.name} · {m.dose}</h4><p>{[m.route,m.frequency,m.duration].filter(Boolean).join(' · ')}</p><p className="mp-muted">{m.instructions}</p></div><span className="mp-badge teal">Đang dùng</span></article>) : <p className="mp-empty-inline">Chưa có thuốc được ghi nhận đang dùng.</p>}</div><p className="mp-footnote">Danh sách phản ánh hồ sơ đã lưu. Hãy xác nhận với bác sĩ nếu thực tế dùng thuốc đã thay đổi.</p></TabsContent>
        <TabsContent value="profile"><SectionHeading title="Thông tin chung" note="Dùng chung cho toàn bộ lịch sử khám của bệnh nhân." /><div className="mp-profile-grid">{[['Mã hồ sơ',patient.medical_record_number],['Ngày sinh',formatDate(patient.birth_date)],['Số điện thoại',patient.phone],['Email',patient.email],['Địa chỉ',patient.address],['Liên hệ khẩn cấp',patient.emergency_contact]].map(([label,value]) => <div key={label}><span>{label}</span><strong>{value || 'Chưa ghi nhận'}</strong></div>)}</div>{patient.general_note && <div data-annotate="general-note" data-annotation-label="Thẻ ghi chú chung" className="mp-panel"><h3>Ghi chú chung</h3><p className="mp-preserve">{patient.general_note}</p></div>}</TabsContent>
      </Tabs><footer className="mp-record-footer">Hồ sơ giả lập · Cập nhật {formatDate(patient.updated_at)}<span>{data.storage.label}</span></footer>
      </> : <div className="mp-empty-card">Chọn hoặc thêm một bệnh nhân để bắt đầu.</div>}
    </main></div>}
    </div>{editPatient && <PatientForm key={editPatient.id} initial={editPatient} onClose={() => setEditPatient(null)} onSaved={patientSaved} />}{editEncounter && patient && <EncounterForm key={editEncounter.id} initial={editEncounter} patient={patient} currentMedications={medicines} doctors={data?.clinicians || []} onClose={() => setEditEncounter(null)} onSaved={encounterSaved} />}
  </div>;
}
function FlaskIcon() { return <Activity size={14} />; }
function ConditionSummary({ condition: c, educationOpen }: { condition: Condition; educationOpen: boolean }) {
  const education = educationForCondition(c.name, c.clinical_term);
  return <div><strong>{c.name}</strong>{c.status === 'resolved' && <span className="mp-badge">Tiền sử</span>}<p>{c.clinical_term}{c.since ? ` · Từ ${c.since}` : ''}</p>{c.note && <p className="mp-preserve">{c.note}</p>}{education && <PatientEducation education={education} defaultOpen={educationOpen} />}</div>;
}
