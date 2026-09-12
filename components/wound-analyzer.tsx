'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, FileImage, FlaskConical, Info, Loader2, ScanLine, ShieldAlert, Upload, X } from 'lucide-react';
import Link from '@/components/app-link';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { analyzeWound, MAX_WOUND_IMAGE_BYTES, WoundApiError, type ClinicalBrief } from '@/lib/wound-api';
import { MOCK_WOUND_PATIENTS, PATIENT_MODE_PROFILE, woundBaseline, type WoundPatient } from '@/lib/wound-patients';

const inputStyle = 'mt-2 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60';
const tissues = [
  { key: 'necrotic', title: 'Mô hoại tử', term: 'Necrotic · đen', color: 'bg-slate-600 dark:bg-slate-400' },
  { key: 'slough', title: 'Mô vàng', term: 'Slough · vàng', color: 'bg-amber-500' },
  { key: 'granulation', title: 'Mô hạt', term: 'Granulation · đỏ', color: 'bg-rose-500' },
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown, fallback = 'Chưa cung cấp'): string {
  return typeof value === 'string' && value ? value : fallback;
}
function number(value: unknown, digits = 2): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export default function WoundAnalyzer() {
  const [ready, setReady] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [developerMode, setDeveloperMode] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(PATIENT_MODE_PROFILE.patient_id);
  const patient = developerMode ? MOCK_WOUND_PATIENTS.find(p => p.patient_id === selectedPatient)! : PATIENT_MODE_PROFILE;
  const [day, setDay] = useState('0');
  const [loading, setLoading] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);
  const [result, setResult] = useState<ClinicalBrief | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { setReady(true); return () => { requestId.current += 1; }; }, []);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { if (result) resultHeading.current?.focus({ preventScroll: true }); }, [result]);

  function clearResult() { setResult(null); setError(null); }

  function resetInput() {
    requestId.current += 1;
    clearResult(); setFile(null); setDay('0');
    if (upload.current) upload.current.value = '';
  }

  async function loadSample() {
    if (loading || loadingSample) return;
    clearResult();
    setFile(null);
    setLoadingSample(true);
    const id = ++requestId.current;
    try {
      const response = await fetch('/wound-demo/day_007_rgb.png');
      if (!response.ok) throw new Error('Không tải được ảnh mẫu. Vui lòng thử lại.');
      const blob = await response.blob();
      if (id !== requestId.current) return;
      setSelectedPatient(PATIENT_MODE_PROFILE.patient_id);
      setDay('7');
      setFile(new File([blob], 'SYN000014-day_007.png', { type: 'image/png' }));
      if (upload.current) upload.current.value = '';
    } catch (caught) {
      if (id === requestId.current) setError({ message: caught instanceof Error ? caught.message : 'Không tải được ảnh mẫu.' });
    } finally {
      if (id === requestId.current) setLoadingSample(false);
    }
  }
  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    clearResult();
    const selected = event.target.files?.[0];
    setFile(null);
    if (!selected) return;
    if (!['image/png', 'image/jpeg'].includes(selected.type) || !selected.size || selected.size > MAX_WOUND_IMAGE_BYTES) {
      setError({ message: 'Chọn ảnh PNG/JPEG có dữ liệu, dung lượng tối đa 8 MiB.' });
      event.target.value = '';
      return;
    }
    setFile(selected);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || loading || loadingSample) return;
    clearResult();
    setLoading(true);
    const id = ++requestId.current;
    try {
      const brief = await analyzeWound(file, woundBaseline(patient), developerMode ? Number(day) : 0,
        { includePipelineVisuals: developerMode });
      if (brief.patient_id !== patient.patient_id) throw new WoundApiError('Kết quả không khớp hồ sơ đã chọn. Vui lòng phân tích lại.');
      if (id === requestId.current) setResult(brief);
    } catch (caught) {
      if (id === requestId.current) setError({
        message: caught instanceof Error ? caught.message : 'Không thể phân tích ảnh. Vui lòng thử lại.',
        status: caught instanceof WoundApiError ? caught.status : undefined,
      });
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  return <main className="min-h-screen bg-background text-foreground transition-colors duration-200 motion-reduce:transition-none" data-testid="wound-analyzer" data-ready={ready} data-mode={developerMode ? 'developer' : 'patient'}>
    <header className="border-b border-border bg-card">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8" aria-label="Điều hướng phân tích ảnh">
        <Link href="/" className="inline-flex items-center gap-2 rounded-lg py-2 font-semibold focus-visible:outline-2"><ArrowLeft className="size-4" />MediPass</Link>
        <Link href="/wounds/history" className="inline-flex items-center gap-2 rounded-lg py-2 text-sm text-muted-foreground hover:text-foreground">Lịch sử & ghi nhận<ArrowUpRight className="size-4" /></Link>
      </nav>
    </header>
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-8 sm:pt-10">
      <div className="mb-6 max-w-3xl" data-annotate="wound-analyzer-intro" data-annotation-label="Giới thiệu phân tích ảnh AI">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300"><FlaskConical className="size-4" />WOUND LAB · PRECISION WOUND CARE</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Phân tích ảnh vết thương</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">{developerMode ? 'Khám phá ảnh, phân vùng mô và kết quả kết hợp hồ sơ nền.' : 'Chọn một ảnh để xem bản tóm tắt dễ đọc cho hồ sơ của bạn.'}</p>
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><Info className="mt-1 size-4 shrink-0" />Mô hình chỉ học ảnh giả lập. Kết quả dành cho nghiên cứu, chưa được xác nhận để chẩn đoán hay quyết định điều trị.</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4">
        <div><p className="font-semibold">{developerMode ? 'Developer Mode' : 'Patient Mode'}</p><p className="mt-1 text-sm text-muted-foreground">{developerMode ? '5 hồ sơ giả lập · bảng nghiên cứu' : `Tài khoản mẫu: ${PATIENT_MODE_PROFILE.display_name} · hồ sơ cố định`}</p></div>
        <div className="flex min-h-11 items-center gap-3 text-sm"><span>Patient Mode</span><Switch checked={developerMode} disabled={!ready || loading || loadingSample} onCheckedChange={checked => { resetInput(); setDeveloperMode(checked); }} aria-label="Developer Mode" /><span>Developer Mode</span></div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <form onSubmit={submit} onChangeCapture={clearResult} className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-label="Dữ liệu phân tích" data-annotate="wound-analyzer-form" data-annotation-label="Ảnh và hồ sơ nền cho AI">
          <fieldset disabled={loading || loadingSample || !ready} className="min-w-0 space-y-5">
            <legend className="mb-4 text-lg font-semibold">1. Ảnh cần phân tích</legend>
            <div>
              <label htmlFor="wound-image" className="text-sm font-medium">Chọn ảnh PNG hoặc JPEG</label>
              <input ref={upload} id="wound-image" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={chooseImage} aria-describedby="upload-help" className={`${inputStyle} cursor-pointer text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:font-medium file:text-secondary-foreground`} />
              <p id="upload-help" className="mt-2 text-sm text-muted-foreground">Tối đa 8 MiB · chỉ dùng dữ liệu giả lập hoặc đã loại định danh.</p>
              {developerMode && <><Button type="button" variant="outline" onClick={() => void loadSample()} className="mt-3 h-11 w-full rounded-xl">{loadingSample ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}{loadingSample ? 'Đang tải mẫu…' : 'Thử ảnh & hồ sơ mẫu'}</Button>
              <p className="mt-2 text-sm text-muted-foreground">Mẫu SYN000014 · ngày 7 · ảnh màu giả lập, không phải ảnh bệnh nhân.</p></>}
            </div>
            {file && preview && <div className="overflow-hidden rounded-xl border border-border">
              <img src={preview} alt="Ảnh được chọn để phân tích" className="h-44 w-full bg-muted object-contain" onError={() => {
                setFile(null); setError({ message: 'Không đọc được ảnh xem trước. Hãy chọn một ảnh PNG/JPEG hợp lệ.' });
                if (upload.current) upload.current.value = '';
              }} />
              <div className="flex items-center justify-between gap-2 p-3"><p className="min-w-0 truncate text-sm" title={file.name}>{file.name}</p><Button type="button" variant="ghost" size="icon" aria-label="Bỏ ảnh đã chọn" onClick={() => { setFile(null); clearResult(); if (upload.current) upload.current.value = ''; }}><X /></Button></div>
            </div>}
            {developerMode && <div className="space-y-4 border-t border-border pt-5">
              <h2 className="text-lg font-semibold">2. Hồ sơ nền</h2>
              <Select value={selectedPatient} disabled={loading || loadingSample} onValueChange={value => { if (typeof value === 'string' && MOCK_WOUND_PATIENTS.some(p => p.patient_id === value)) { resetInput(); setSelectedPatient(value); } }}>
                <SelectTrigger aria-label="Chọn bệnh nhân giả lập" className="h-12! w-full rounded-xl text-base"><SelectValue>{patient.display_name} · {patient.patient_id}</SelectValue></SelectTrigger>
                <SelectContent>{MOCK_WOUND_PATIENTS.map(profile => <SelectItem key={profile.patient_id} value={profile.patient_id} className="min-h-11">{profile.display_name} · {profile.patient_id}</SelectItem>)}</SelectContent>
              </Select>
              <BaselineSummary patient={patient} />
              <Field label="Ngày theo dõi" id="baseline-day"><input id="baseline-day" type="number" required min="0" step="any" value={day} onChange={e => setDay(e.target.value)} className={inputStyle} /></Field>
              <p className="text-sm text-muted-foreground">Ngày tương đối của ảnh; một ảnh không tạo thành chuỗi theo dõi.</p>
            </div>}
          </fieldset>
          {error && <div role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><p className="font-semibold">Không thể phân tích{error.status ? ` · HTTP ${error.status}` : ''}</p><p className="mt-1 break-words">{error.message}</p></div>}
          <Button type="submit" disabled={!ready || !file || loading} className="mt-5 h-12 w-full gap-2 rounded-xl bg-teal-700 text-base text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500">{loading ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" /> : <ScanLine className="size-5" />}{loading ? 'Đang phân tích…' : 'Phân tích ảnh'}</Button>
          <p className="mt-3 text-center text-sm text-muted-foreground">Dịch vụ Python trên máy này · cổng 8000</p>
        </form>

        <section className="min-w-0" aria-label="Kết quả phân tích" aria-busy={loading} data-annotate="wound-analyzer-results" data-annotation-label="Bảng kết quả phân tích AI">
          <p role="status" className="sr-only">{loading ? 'Đang gửi ảnh và phân tích.' : result ? 'Đã nhận kết quả phân tích.' : 'Chưa có kết quả phân tích.'}</p>
          {loading ? <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center"><Loader2 className="mb-4 size-9 animate-spin text-teal-600 motion-reduce:animate-none" /><h2 className="text-xl font-semibold">Đang đọc ảnh và hồ sơ nền</h2><p className="mt-3 text-muted-foreground">Vui lòng giữ trang mở trong khi mô hình xử lý.</p></div>
            : result ? <><h2 ref={resultHeading} tabIndex={-1} className="mb-4 text-xl font-semibold outline-none">Kết quả phân tích</h2>{developerMode ? <><DeveloperOutcome brief={result} /><details className="mt-4 rounded-2xl border border-border bg-card p-5"><summary className="cursor-pointer font-semibold">Clinical Brief & metadata</summary><div className="mt-5"><ResultDashboard brief={result} /></div></details><PipelineDashboard brief={result} patient={patient} /></> : <PatientBrief brief={result} />}</>
            : <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center"><div className="mb-4 rounded-2xl bg-secondary p-4"><FileImage className="size-8 text-teal-700 dark:text-teal-300" /></div><h2 className="text-xl font-semibold">Bắt đầu với một ảnh</h2><p className="mt-3 max-w-sm leading-7 text-muted-foreground">Chọn ảnh và kiểm tra hồ sơ nền. Thành phần mô, chất lượng ảnh và nhận xét sẽ xuất hiện tại đây.</p><span className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Upload className="size-4" />PNG / JPEG</span></div>}
        </section>
      </div>
    </div>
  </main>;
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return <div className="min-w-0"><label htmlFor={id} className="text-sm font-medium">{label}</label>{children}</div>;
}

function BaselineSummary({ patient }: { patient: WoundPatient }) {
  return <dl data-testid="baseline-summary" className="grid grid-cols-2 gap-3 rounded-xl bg-secondary/50 p-4 text-sm [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:font-semibold">
    <div><dt>Tuổi</dt><dd>{patient.age}</dd></div><div><dt>Nhóm máu</dt><dd>{patient.blood_type}</dd></div>
    <div><dt>HbA1c</dt><dd>{patient.hba1c_level}%</dd></div><div><dt>Đái tháo đường típ 2</dt><dd>{patient.has_diabetes_type_2 ? 'Có' : 'Không'}</dd></div>
    <div><dt>Tăng huyết áp</dt><dd>{patient.hypertension ? 'Có' : 'Không'}</dd></div>
  </dl>;
}

function PatientBrief({ brief }: { brief: ClinicalBrief }) {
  const latest = brief.objective_measurements.visits.at(-1)!;
  const usable = latest.tissue_percentages !== null;
  return <div data-testid="patient-brief" className="space-y-4 animate-in fade-in duration-200 motion-reduce:animate-none">
    <section className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-xl font-semibold">{usable ? 'Bản tóm tắt ảnh của bạn' : 'Ảnh chưa đủ rõ để đọc kết quả'}</h3>
      <p className="mt-3 leading-7 text-muted-foreground">{usable ? 'Dưới đây là ước tính các vùng màu trong ảnh. Các con số này chưa xác định được vết thương đang lành hay xấu đi.' : 'Ứng dụng chưa đưa ra ước tính từ ảnh này. Bạn có thể chọn một ảnh rõ hơn, đủ sáng và thử lại.'}</p>
      {usable && <dl className="mt-5 space-y-3">{tissues.map((tissue, index) => <div key={tissue.key} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"><dt className="flex items-center gap-3"><span aria-hidden="true" className={`size-3 rounded-full ${tissue.color}`} />{['Vùng màu đen', 'Vùng màu vàng', 'Vùng màu đỏ'][index]}</dt><dd className="font-semibold tabular-nums">{latest.tissue_percentages![tissue.key].toFixed(1)}%</dd></div>)}</dl>}
    </section>
    <section className="rounded-2xl border border-teal-200 bg-teal-50 p-6 dark:border-teal-900 dark:bg-teal-950/30"><h3 className="font-semibold">Bạn nên hiểu kết quả thế nào?</h3><p className="mt-3 leading-7">Một ảnh chưa đủ để biết tốc độ hồi phục. Kết quả này cần được người có chuyên môn xem cùng ảnh gốc và hồ sơ của bạn.</p><p className="mt-3 text-sm leading-6 text-muted-foreground">Đây là bản thử nghiệm học từ ảnh giả lập. Không dùng kết quả để tự chẩn đoán hoặc thay đổi điều trị.</p></section>
  </div>;
}

function DeveloperOutcome({ brief }: { brief: ClinicalBrief }) {
  const visit = brief.objective_measurements.visits.at(-1)!;
  return <section className="rounded-2xl border border-border bg-card p-5" data-testid="developer-outcome">
    <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">LATE FUSION · ẢNH + HỒ SƠ NỀN</p>
    <div className="mt-5 grid grid-cols-3 gap-3">{tissues.map(tissue => <div key={tissue.key}><p className="text-sm text-muted-foreground">{tissue.title}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{visit.tissue_percentages ? `${visit.tissue_percentages[tissue.key].toFixed(1)}%` : '—'}</p></div>)}</div>
    <div className="mt-5 flex items-center justify-between border-t border-border pt-4"><span>Điểm mô phỏng</span><span className="font-semibold">{number(visit.risk_deterioration_score)} / 1</span></div>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Điểm chưa hiệu chuẩn. Một ảnh không cho biết xu hướng hồi phục; không kết luận an toàn từ việc thiếu cảnh báo.</p>
  </section>;
}

function visualSource(value: unknown, mime: unknown): string | undefined {
  // Only bounded raster data is rendered. Never accept a backend-supplied URL/HTML/SVG.
  if (typeof value !== 'string' || !value.length || value.length > 12_000_000
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || !['image/png', 'image/jpeg'].includes(String(mime))) return;
  return `data:${mime};base64,${value}`;
}

function PipelineImage({ src, label, fallback }: { src?: string; label: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed
    ? <img src={src} alt={label} className="aspect-square w-full rounded-xl bg-[repeating-conic-gradient(#a7b0b5_0%_25%,#d3dadd_0%_50%)] bg-size-[16px_16px] object-contain" onError={() => setFailed(true)} />
    : <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border p-4 text-center text-sm leading-6 text-muted-foreground">{fallback}</div>;
}

function PipelineDashboard({ brief, patient }: { brief: ClinicalBrief; patient: WoundPatient }) {
  const visuals = asRecord(brief.pipeline_visuals);
  const model = asRecord(visuals.model);
  const available = visuals.status === 'available';
  const fallback = visuals.status === 'quality_abstained' ? 'Ảnh chưa đạt kiểm tra chất lượng; không tạo lớp phân vùng.' : 'Chưa có đầu ra U-Net. Clinical Brief vẫn dùng được khi thiếu phần hình ảnh bổ sung.';
  const panels = [
    { title: 'Input Image', label: 'Ảnh đầu vào', src: visualSource(visuals.original_image, visuals.original_mime_type), note: 'Ảnh gốc được gửi trong yêu cầu này.' },
    { title: 'U-Net Isolated Wound Area', label: 'Vùng mô do U-Net phân vùng', src: available ? visualSource(visuals.unet_segmentation_mask, 'image/png') : undefined, note: 'Nền dự đoán được làm trong suốt; phần tối trong vết thương vẫn được giữ lại.' },
    { title: 'Tissue Detection Overlay', label: 'Lớp phủ phân loại mô', src: available ? visualSource(visuals.tissue_analysis_overlay, 'image/png') : undefined, note: visuals.tissue_status === 'no_wound_pixels' ? 'Mô hình không chọn được vùng vết thương ở ngưỡng hiện tại nên không tô màu mô; điều này không xác nhận ảnh không có tổn thương.' : 'Xám: Necrotic · Vàng: Slough · Đỏ: Granulation. Mô hình mô giả lập riêng chỉ tô màu bên trong vùng vết thương đã phân đoạn.' },
  ];
  return <section data-testid="pipeline-visualization" aria-label="Pipeline Visualization" className="mt-8 animate-in fade-in duration-200 motion-reduce:animate-none">
    <div className="mb-5"><h2 className="text-2xl font-semibold">Pipeline Visualization</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">U-Net giới hạn vùng vết thương; tỷ lệ mô được đếm trong vùng này. Mô hình late fusion nhận vùng ảnh đã tách nền cùng hồ sơ nền để tính điểm mô phỏng riêng. Hình phân vùng không phải bản đồ giải thích quyết định của mô hình.</p></div>
    <div className="grid items-start gap-4 sm:grid-cols-2">
      {panels.map((panel, index) => <article key={panel.title} className="min-w-0 rounded-2xl border border-border bg-card p-4"><span className="mb-3 inline-flex size-8 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">{index + 1}</span><h3 className="mb-4 min-h-12 font-semibold">{panel.title}</h3><PipelineImage src={panel.src} label={panel.label} fallback={index === 0 ? 'Máy chủ chưa cung cấp ảnh đầu vào.' : index === 2 && visuals.tissue_status === 'unavailable' ? 'Đã phân vùng vết thương; mô hình phân loại mô bổ sung chưa sẵn sàng.' : fallback} /><p className="mt-3 text-sm leading-6 text-muted-foreground">{panel.note}</p></article>)}
      <article className="min-w-0 rounded-2xl border border-teal-300 bg-card p-4 dark:border-teal-900"><span className="mb-3 inline-flex size-8 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">4</span><h3 className="mb-4 font-semibold">Final Clinical Brief & Fused Tabular Data</h3><p className="mb-3 text-sm font-semibold">{patient.display_name} · {patient.patient_id}</p><BaselineSummary patient={patient} /><p className="mt-4 text-sm leading-6 text-muted-foreground">{brief.multimodal_context_analysis}</p></article>
    </div>
    <p className="mt-4 text-sm leading-6 text-muted-foreground">{available ? `U-Net: ${text(model.version)}. Phân vùng chưa được xác nhận lâm sàng.` : text(visuals.reason, 'Máy chủ hiện tại chưa hỗ trợ pipeline_visuals.')} API v2 tính phần trăm trên toàn bộ vùng vết thương, gồm cả phần chưa phân loại; không tính da và nền bên ngoài.</p>
  </section>;
}

function ResultDashboard({ brief }: { brief: ClinicalBrief }) {
  const measurements = brief.objective_measurements;
  const latest = measurements.visits[measurements.visits.length - 1];
  const quality = asRecord(latest.quality);
  const provenance = asRecord(brief.provenance);
  const uncertainty = asRecord(brief.uncertainty);
  const alerts = Array.isArray(brief.risk_alerts) ? brief.risk_alerts.map(asRecord) : [];
  const priority = text(brief.research_review_priority, 'unknown');
  const priorityLabel: Record<string, string> = { insufficient_data: 'Chưa đủ ảnh để so sánh', elevated: 'Có dấu hiệu cần xem lại trong bản mô phỏng', manual_review: 'Cần người chuyên môn xem lại' };
  const qualityLabels: Record<string, string> = { extreme_exposure: 'Ảnh quá tối hoặc quá sáng', near_uniform_image: 'Ảnh thiếu tương phản', low_detail_or_blur: 'Ảnh mờ hoặc ít chi tiết' };
  return <div className="space-y-5" data-testid="clinical-brief">
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="flex items-start gap-2 font-semibold"><ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />{priorityLabel[priority] || 'Kết quả cần xem lại'}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Ước tính từ mô hình · chưa phải đo đạc đã được xác nhận.</p>
      {!measurements.trajectory_available && <p className="mt-2 text-sm leading-6 text-muted-foreground">Một ảnh chưa cho biết vết thương đang lành hay xấu đi. Lần phân tích này không tạo lịch sử theo dõi.</p>}
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {tissues.map(tissue => {
        const value = latest.tissue_percentages?.[tissue.key];
        return <article key={tissue.key} className="min-w-0 rounded-2xl border border-border bg-card p-4" aria-label={tissue.title}>
          <p className="font-semibold">{tissue.title}</p><p className="mt-1 text-sm text-muted-foreground">{tissue.term}</p>
          <p className="my-4 text-3xl font-semibold tabular-nums">{value === undefined ? '—' : `${value.toFixed(1)}%`}</p>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className={`h-full rounded-full ${tissue.color}`} style={{ width: `${value ?? 0}%` }} /></div>
          {value === undefined && <p className="mt-2 text-sm text-muted-foreground">Chưa có ước tính</p>}
        </article>;
      })}
    </div>
    <div className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
      <div><h3 className="font-semibold">Điểm mô phỏng</h3><p className="mt-2 text-2xl font-semibold tabular-nums">{number(latest.risk_deterioration_score)} <span className="text-sm font-normal text-muted-foreground">/ 1</span></p><p className="mt-2 text-sm leading-6 text-muted-foreground">Không phải độ tin cậy hay xác suất nguy hiểm đã được xác nhận.</p></div>
      <div><h3 className="font-semibold">Chất lượng ảnh</h3><p className="mt-2 text-sm leading-6">{quality.usable_for_demo === true ? 'Qua kiểm tra ảnh cơ bản cho bản demo' : quality.usable_for_demo === false ? 'Ảnh chưa đạt kiểm tra cơ bản' : 'Chưa có đánh giá chất lượng'}</p>{strings(quality.reasons).map(reason => <p key={reason} className="mt-1 text-sm text-amber-700 dark:text-amber-300">{qualityLabels[reason] || reason}</p>)}</div>
    </div>
    {alerts.length > 0 && <section className="rounded-2xl border border-amber-300/60 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30"><h3 className="font-semibold">Dấu hiệu do quy tắc mô phỏng đánh dấu</h3><ul className="mt-3 space-y-2 text-sm leading-6">{alerts.map((alert, index) => <li key={index}>{alert.kind === 'uncalibrated_simulator_score_flag' ? `Điểm mô phỏng ${number(alert.score)} đạt ngưỡng nghiên cứu ${number(alert.threshold)}.` : `${text(alert.tissue, 'Thành phần mô')}: thay đổi ${number(alert.observed_change_pp)} điểm phần trăm; ngưỡng nghiên cứu ${number(alert.threshold_pp)}.`}</li>)}</ul></section>}
    <section className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">Nhận xét theo hồ sơ nền</h3><p className="mt-3 whitespace-pre-line break-words text-base leading-7 text-muted-foreground">{brief.multimodal_context_analysis}</p></section>
    <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5 dark:border-teal-900 dark:bg-teal-950/30"><h3 className="font-semibold">Bước xem xét tiếp theo</h3><p className="mt-3 whitespace-pre-line break-words text-base leading-7">{brief.system_recommendation}</p></section>
    <details className="rounded-2xl border border-border bg-card p-5">
      <summary className="cursor-pointer font-semibold">Thông tin mô hình & giới hạn</summary>
      <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-x-4 gap-y-3 text-sm [&_dd]:break-words [&_dt]:text-muted-foreground">
        <dt>Bệnh nhân</dt><dd>{text(brief.patient_id)}</dd>
        <dt>Ngày theo dõi</dt><dd>{number(latest.day, 1)}</dd>
        <dt>Mô hình</dt><dd>{text(provenance.model_version)}</dd>
        <dt>Epoch checkpoint</dt><dd>{number(provenance.checkpoint_epoch, 0)}</dd>
        <dt>Khoảng điểm mô phỏng</dt><dd>{number(measurements.risk_score_horizon_days, 0)} ngày</dd>
        <dt>Diện tích</dt><dd>{typeof measurements.area_cm2 === 'number' && Number.isFinite(measurements.area_cm2) ? `${number(measurements.area_cm2)} cm²` : 'Chưa có đo đạc hiệu chuẩn'}</dd>
        <dt>Hiệu chỉnh độ bất định</dt><dd>{uncertainty.calibrated === true ? 'Máy chủ báo đã hiệu chỉnh' : 'Chưa được xác nhận'}</dd>
        <dt>Định danh checkpoint</dt><dd className="break-all! font-mono">{text(provenance.checkpoint_sha256)}</dd>
      </dl>
      {strings(brief.limitations).length > 0 && <ul className="mt-5 list-disc space-y-2 pl-4 text-sm leading-6 text-muted-foreground">{strings(brief.limitations).map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>}
    </details>
  </div>;
}
