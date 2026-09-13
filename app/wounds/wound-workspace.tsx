'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileHeart,
  ImagePlus,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Ruler,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UploadCloud,
  X,
} from 'lucide-react';
import Link from '@/components/app-link';
import MediPassBrand from '@/components/medipass-brand';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SyntheticEvent,
} from 'react';

import {
  emptyWoundSymptoms,
  type HistoryFactor,
  type WoundSafetyReview,
  type WoundSymptoms,
  type WoundTriageLevel,
} from '@/lib/wound-safety';

type Assessment = {
  id: string;
  image_object_id: string;
  image_url: string;
  image_name: string;
  captured_at: string;
  pain_score: number;
  symptoms: WoundSymptoms;
  capture: { hasScaleMarker?: boolean; exifRemovedByClient?: boolean };
  notes: string | null;
  triage_level: WoundTriageLevel;
  safety_review: WoundSafetyReview;
  history_factors: HistoryFactor[];
  created_at: string;
};

type WoundCase = {
  id: string;
  label: string;
  body_location: string;
  wound_type: string;
  onset_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  assessments: Assessment[];
};

type WoundData = {
  patient: { display_name: string };
  access: { role: string; can_capture: boolean };
  patient_context: {
    matched_factors: HistoryFactor[];
    record_count: number;
  };
  model: { connected: false; contractVersion: string; message: string };
  cases: WoundCase[];
};

type CaptureForm = {
  caseId: string;
  label: string;
  bodyLocation: string;
  woundType: string;
  onsetDate: string;
  capturedAt: string;
  painScore: number;
  hasScaleMarker: boolean;
  notes: string;
  consentAttested: boolean;
  researchUseOnly: boolean;
};

const symptomOptions: Array<{
  key: keyof WoundSymptoms;
  label: string;
  urgent?: boolean;
}> = [
  { key: 'uncontrolledBleeding', label: 'Severe bleeding or bleeding that will not stop', urgent: true },
  { key: 'lossOfSensationOrFunction', label: 'Loss of feeling or normal function', urgent: true },
  { key: 'exposedDeepStructure', label: 'Deep tissue, tendon, or bone may be visible', urgent: true },
  { key: 'fever', label: 'Fever or feeling seriously unwell' },
  { key: 'redStreaks', label: 'Red streak extending from the wound' },
  { key: 'pusDrainage', label: 'Pus-like drainage' },
  { key: 'spreadingRedness', label: 'Redness is spreading' },
  { key: 'worseningPain', label: 'Pain is getting worse' },
  { key: 'warmth', label: 'New warmth around the wound' },
  { key: 'swelling', label: 'New or increasing swelling' },
  { key: 'deepOrGaping', label: 'Deep or gaping wound' },
  { key: 'bite', label: 'Human or animal bite' },
  { key: 'puncture', label: 'Puncture wound' },
  { key: 'foreignObject', label: 'Object or debris may be stuck inside' },
  { key: 'dirtyWound', label: 'Contact with dirt, soil, saliva, or other contamination' },
];

const triageTone: Record<
  WoundTriageLevel,
  { border: string; background: string; text: string; icon: typeof ShieldAlert }
> = {
  emergency: {
    border: 'border-rose-300 dark:border-rose-900',
    background: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-900 dark:text-rose-200',
    icon: ShieldAlert,
  },
  'same-day': {
    border: 'border-orange-300 dark:border-orange-900',
    background: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-950 dark:text-orange-200',
    icon: AlertTriangle,
  },
  'prompt-review': {
    border: 'border-amber-300 dark:border-amber-900',
    background: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-950 dark:text-amber-200',
    icon: Clock3,
  },
  monitor: {
    border: 'border-blue-200 dark:border-blue-900',
    background: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-950 dark:text-blue-200',
    icon: ShieldCheck,
  },
};

function localDateTimeValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function blankForm(): CaptureForm {
  return {
    caseId: '',
    label: '',
    bodyLocation: '',
    woundType: 'unknown',
    onsetDate: '',
    capturedAt: localDateTimeValue(),
    painScore: 0,
    hasScaleMarker: false,
    notes: '',
    consentAttested: false,
    researchUseOnly: false,
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

async function sanitizeWoundImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const maxDimension = 1800;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable in this browser.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!blob) throw new Error('The selected image could not be prepared.');
    const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'wound-capture';
    return new File([blob], `${baseName}-sanitized.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

export function WoundWorkspace() {
  const [data, setData] = useState<WoundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CaptureForm>(() => blankForm());
  const [symptoms, setSymptoms] = useState<WoundSymptoms>(() => emptyWoundSymptoms());
  const [image, setImage] = useState<File | null>(null);
  const [latestReview, setLatestReview] = useState<WoundSafetyReview | null>(null);

  const loadData = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/wounds', { cache: 'no-store' });
      const payload = (await response.json()) as WoundData & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not load wound monitoring.');
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load wound monitoring.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : ''), [image]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const selectedCase = useMemo(
    () => data?.cases.find((woundCase) => woundCase.id === form.caseId) ?? null,
    [data?.cases, form.caseId],
  );

  const allAssessments = useMemo(
    () =>
      (data?.cases ?? [])
        .flatMap((woundCase) =>
          woundCase.assessments.map((assessment) => ({ woundCase, assessment })),
        )
        .sort(
          (a, b) =>
            new Date(b.assessment.captured_at).getTime() -
            new Date(a.assessment.captured_at).getTime(),
        ),
    [data?.cases],
  );

  async function chooseImage(file: File | null) {
    if (!file) return;
    setError('');
    setProcessingImage(true);
    try {
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        throw new Error('Choose a JPEG or PNG image.');
      }
      if (file.size > 8 * 1024 * 1024) {
        throw new Error('Choose an image smaller than 8 MB.');
      }
      setImage(await sanitizeWoundImage(file));
    } catch (caught) {
      setImage(null);
      setError(
        caught instanceof Error
          ? caught.message
          : 'The selected image could not be prepared.',
      );
    } finally {
      setProcessingImage(false);
    }
  }

  async function submitAssessment(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image) {
      setError('Take or choose a wound photo before continuing.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = new FormData();
      body.append('image', image);
      body.append('case_id', form.caseId);
      body.append('label', form.label);
      body.append('body_location', form.bodyLocation);
      body.append('wound_type', form.woundType);
      body.append('onset_date', form.onsetDate);
      body.append('captured_at', form.capturedAt);
      body.append('pain_score', String(form.painScore));
      body.append('has_scale_marker', String(form.hasScaleMarker));
      body.append('notes', form.notes);
      body.append('symptoms', JSON.stringify(symptoms));
      body.append('consent_attested', String(form.consentAttested));
      body.append('research_use_only', String(form.researchUseOnly));
      body.append('exif_removed', 'true');

      const response = await fetch('/api/wounds', { method: 'POST', body });
      const payload = (await response.json()) as {
        error?: string;
        safety_review?: WoundSafetyReview;
      };
      if (!response.ok || !payload.safety_review) {
        throw new Error(payload.error || 'Could not save this assessment.');
      }
      setLatestReview(payload.safety_review);
      setForm(blankForm());
      setSymptoms(emptyWoundSymptoms());
      setImage(null);
      await loadData();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this assessment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/wounds"
            className="grid size-11 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Về phân tích AI Wound Lab"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/" className="flex min-h-11 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-primary" aria-label="MediPass home"><MediPassBrand compact subtitle="WOUND HISTORY" /></Link>
          <Link href="/wounds" aria-label="Phân tích ảnh AI" className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-sm font-semibold text-blue-900 dark:text-blue-200 hover:bg-blue-100">
            <Sparkles className="size-4" /><span className="hidden sm:inline">Phân tích ảnh AI</span><span className="sm:hidden">AI</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <div className="overflow-hidden rounded-3xl bg-[#0F172A] p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-400/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-blue-300">
                Research prototype
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                {data?.patient.display_name ?? 'Demo patient'}
              </span>
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Lịch sử & ghi nhận vết thương
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Mỗi ảnh được lưu cùng ngày chụp, triệu chứng và ghi chú trong một hồ sơ vết thương. Mở Phân tích ảnh AI để thử mô hình ảnh + hồ sơ nền; phần lưu trữ này tiếp tục dùng kiểm tra triệu chứng theo quy tắc.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ['1', 'Standardized RGB capture'],
                ['2', 'Patient-specific context'],
                ['3', 'Clinician-reviewable timeline'],
              ].map(([number, label]) => (
                <div key={number} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-card/5 p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-blue-400/15 text-xs font-bold text-blue-300">
                    {number}
                  </span>
                  <span className="text-sm text-slate-200">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <article className="rounded-3xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-6">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200">
              <ShieldAlert className="size-5" />
              <h2 className="font-semibold">Emergency boundary</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-rose-950/80 dark:text-rose-200">
              This prototype is not emergency care. For severe bleeding that will not stop, loss of feeling or function, or a serious deep injury, call 911 or your local emergency number now.
            </p>
            <div className="mt-4 rounded-2xl border border-rose-200 dark:border-rose-900 bg-card/70 p-3 text-xs leading-5 text-rose-900 dark:text-rose-200">
              Never wait for an upload, score, or AI result when urgent help may be needed.
            </div>
          </article>
        </section>

        {latestReview && (
          <div className="mt-5">
            <SafetyReviewCard review={latestReview} title="Latest safety review" />
          </div>
        )}

        {error && (
          <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 dark:border-rose-900 bg-card p-4 text-sm text-rose-800 dark:text-rose-200 shadow-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1">{error}</p>
            <button type="button" onClick={() => setError('')} aria-label="Dismiss error">
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
          <form onSubmit={submitAssessment} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-5 sm:px-7">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-200">
                  <Camera className="size-5" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">New wound assessment</h2>
                  <p className="text-sm text-muted-foreground">Capture consistently so change is easier to review.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-2">
              <section>
                <h3 className="text-sm font-semibold text-foreground">1. Wound photo</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Use even lighting, keep the camera parallel, avoid filters, and exclude faces or identifiers.
                </p>
                <label className="mt-4 block cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-input bg-muted transition hover:border-blue-500 hover:bg-blue-50/40">
                  <span className="sr-only">Take or choose a wound photo</span>
                  {previewUrl ? (
                    <div className="relative aspect-[4/3] bg-slate-950">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Prepared wound capture preview" className="size-full object-contain" />
                      <span className="absolute bottom-3 left-3 rounded-full bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                        Metadata removed
                      </span>
                    </div>
                  ) : (
                    <div className="grid aspect-[4/3] place-items-center p-6 text-center">
                      <div>
                        {processingImage ? (
                          <Loader2 className="mx-auto size-8 animate-spin text-blue-700 dark:text-blue-200" />
                        ) : (
                          <ImagePlus className="mx-auto size-8 text-blue-700 dark:text-blue-200" />
                        )}
                        <span className="mt-3 block text-sm font-semibold text-foreground">
                          {processingImage ? 'Removing image metadata…' : 'Take photo or choose image'}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">JPEG or PNG · maximum 8 MB</span>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    capture="environment"
                    className="sr-only"
                    disabled={processingImage || saving}
                    onChange={(event) => void chooseImage(event.target.files?.[0] ?? null)}
                  />
                </label>
                <label
                  aria-label="Confirm that a calibration marker is visible"
                  className="mt-3 flex min-h-12 items-start gap-3 rounded-xl border border-border p-3 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={form.hasScaleMarker}
                    onChange={(event) => setForm((current) => ({ ...current, hasScaleMarker: event.target.checked }))}
                    className="mt-0.5 size-4 accent-blue-700"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 font-semibold"><Ruler className="size-3.5" /> Calibration marker is visible</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Needed later for physical area estimates; do not place a non-sterile object on the wound.</span>
                  </span>
                </label>
              </section>

              <section className="space-y-4">
                <div>
                  <label htmlFor="wound-case" className="text-sm font-semibold text-foreground">2. Match the timeline</label>
                  <select
                    id="wound-case"
                    value={form.caseId}
                    onChange={(event) => setForm((current) => ({ ...current, caseId: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                  >
                    <option value="">Start a new wound case</option>
                    {(data?.cases ?? []).map((woundCase) => (
                      <option key={woundCase.id} value={woundCase.id}>
                        {woundCase.label} · {woundCase.body_location}
                      </option>
                    ))}
                  </select>
                </div>

                {!selectedCase && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Case name" required>
                        <input
                          value={form.label}
                          onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                          placeholder="e.g. Left heel wound"
                          required
                          maxLength={120}
                          className="h-11 w-full rounded-xl border border-border px-3 text-sm outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                        />
                      </Field>
                      <Field label="Body location" required>
                        <input
                          value={form.bodyLocation}
                          onChange={(event) => setForm((current) => ({ ...current, bodyLocation: event.target.value }))}
                          placeholder="e.g. left heel"
                          required
                          maxLength={100}
                          className="h-11 w-full rounded-xl border border-border px-3 text-sm outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                        />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Wound category">
                        <select
                          value={form.woundType}
                          onChange={(event) => setForm((current) => ({ ...current, woundType: event.target.value }))}
                          className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                        >
                          <option value="unknown">Not sure</option>
                          <option value="acute">Acute injury</option>
                          <option value="surgical">Surgical wound</option>
                          <option value="pressure">Pressure injury</option>
                          <option value="diabetic-foot">Diabetic foot wound</option>
                          <option value="other">Other</option>
                        </select>
                      </Field>
                      <Field label="Approximate onset">
                        <input
                          type="date"
                          value={form.onsetDate}
                          onChange={(event) => setForm((current) => ({ ...current, onsetDate: event.target.value }))}
                          className="h-11 w-full rounded-xl border border-border px-3 text-sm outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                        />
                      </Field>
                    </div>
                  </>
                )}

                {selectedCase && (
                  <div className="rounded-2xl border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-4 text-sm">
                    <p className="font-semibold text-blue-950 dark:text-blue-200">{selectedCase.label}</p>
                    <p className="mt-1 text-blue-900/70 dark:text-blue-200">
                      {selectedCase.body_location} · {selectedCase.assessments.length} previous {selectedCase.assessments.length === 1 ? 'capture' : 'captures'}
                    </p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Captured at">
                    <input
                      type="datetime-local"
                      value={form.capturedAt}
                      onChange={(event) => setForm((current) => ({ ...current, capturedAt: event.target.value }))}
                      className="h-11 w-full rounded-xl border border-border px-3 text-sm outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                    />
                  </Field>
                  <Field label={`Pain reported: ${form.painScore}/10`}>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={form.painScore}
                      onChange={(event) => setForm((current) => ({ ...current, painScore: Number(event.target.value) }))}
                      className="mt-2 h-6 w-full accent-blue-700"
                    />
                  </Field>
                </div>
              </section>
            </div>

            <section className="border-t border-border bg-muted/60 p-5 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200">
                  <ShieldCheck className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">3. Report what is happening now</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Select only what you can observe. The checklist does not replace an examination.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {symptomOptions.map((option) => (
                  <label
                    key={option.key}
                    className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
                      symptoms[option.key]
                        ? option.urgent
                          ? 'border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200'
                          : 'border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200'
                        : 'border-border bg-card text-foreground hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={symptoms[option.key]}
                      onChange={(event) =>
                        setSymptoms((current) => ({ ...current, [option.key]: event.target.checked }))
                      }
                      className="mt-0.5 size-4 accent-blue-700"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <Field label="Observation notes" className="mt-4">
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="What changed since the last capture? Include clinician instructions if relevant."
                  maxLength={1500}
                  rows={4}
                  className="w-full rounded-xl border border-border p-3 text-sm leading-6 outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/15"
                />
              </Field>
            </section>

            <section className="border-t border-border p-5 sm:p-7">
              <div className="space-y-3">
                <ConsentCheck
                  checked={form.consentAttested}
                  onChange={(checked) => setForm((current) => ({ ...current, consentAttested: checked }))}
                >
                  I have permission to use this photo, and it contains no face, name, tattoo, label, or other identifying feature.
                </ConsentCheck>
                <ConsentCheck
                  checked={form.researchUseOnly}
                  onChange={(checked) => setForm((current) => ({ ...current, researchUseOnly: checked }))}
                >
                  I understand this is a research prototype, not a diagnosis or emergency service.
                </ConsentCheck>
              </div>
              <button
                type="submit"
                disabled={saving || processingImage || !image || !form.consentAttested || !form.researchUseOnly}
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
                {saving ? 'Saving assessment…' : 'Save and run safety review'}
              </button>
            </section>
          </form>

          <aside className="space-y-5">
            <article className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileHeart className="size-4 text-blue-700 dark:text-blue-200" />
                  <h2 className="text-sm font-semibold">Record-aware context</h2>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {data?.patient_context.record_count ?? 0} records
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Only explicitly saved, active records are matched. No missing condition is inferred.
              </p>
              <div className="mt-4 space-y-3">
                {(data?.patient_context.matched_factors ?? []).length ? (
                  data?.patient_context.matched_factors.map((factor) => (
                    <div key={factor.key} className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4">
                      <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">{factor.label}</p>
                      <p className="mt-1 text-xs leading-5 text-amber-900/75 dark:text-amber-200">{factor.note}</p>
                      <p className="mt-2 text-xs font-medium text-amber-900 dark:text-amber-200">Matched: {factor.evidence.join(', ')}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-border bg-muted p-4">
                    <p className="text-sm font-semibold text-foreground">No configured risk factor matched</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">This does not mean none exists. The record may be incomplete or use different wording.</p>
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
                <CircleHelp className="size-4" />
                <h2 className="text-sm font-semibold">Lưu trữ và phân tích AI</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-blue-950/75 dark:text-blue-200">
                Ảnh và ghi nhận ở đây được lưu vào lịch sử. Phân tích AI dùng dịch vụ Python cục bộ và không tự ghi kết quả vào hồ sơ đã lưu.
              </p>
              <div className="mt-4 grid gap-2 text-xs text-blue-900 dark:text-blue-200">
                <div className="flex items-center gap-2 rounded-xl bg-card/70 p-3">
                  <CheckCircle2 className="size-4 shrink-0 text-blue-700 dark:text-blue-200" /> Versioned input/output contract
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-card/70 p-3">
                  <CheckCircle2 className="size-4 shrink-0 text-blue-700 dark:text-blue-200" /> Human review required by schema
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-card/70 p-3">
                  <X className="size-4 shrink-0 text-rose-700 dark:text-rose-200" /> No segmentation or healing forecast yet
                </div>
              </div>
            </article>

            <article className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-blue-700 dark:text-blue-200" />
                <h2 className="text-sm font-semibold">Research progression</h2>
              </div>
              <ol className="mt-4 space-y-3 text-sm">
                {[
                  ['Now', 'Repeatable capture + symptom and history context'],
                  ['Next', 'Clinician annotation and wound segmentation'],
                  ['Then', 'Objective area trend with calibrated images'],
                  ['Validate', 'Patient-level split and external clinical review'],
                ].map(([phase, text]) => (
                  <li key={phase} className="flex gap-3">
                    <span className="w-14 shrink-0 text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-200">{phase}</span>
                    <span className="text-sm leading-5 text-muted-foreground">{text}</span>
                  </li>
                ))}
              </ol>
            </article>
          </aside>
        </div>

        <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-200">Longitudinal record</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Assessment history</h2>
              <p className="mt-1 text-sm text-muted-foreground">Compare repeat captures from the same case; do not compare unrelated wounds.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              <RefreshCw className="size-4" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-blue-700 dark:text-blue-200" /> Loading assessments…
            </div>
          ) : allAssessments.length ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {allAssessments.map(({ woundCase, assessment }) => (
                <AssessmentCard key={assessment.id} woundCase={woundCase} assessment={assessment} />
              ))}
            </div>
          ) : (
            <div className="mt-5 grid min-h-48 place-items-center rounded-2xl border border-dashed border-input bg-muted p-6 text-center">
              <div>
                <Camera className="mx-auto size-7 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold text-foreground">No wound captures yet</p>
                <p className="mt-1 text-xs text-muted-foreground">The first saved assessment will start a longitudinal case.</p>
              </div>
            </div>
          )}
        </section>

        <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-border py-5 text-xs leading-5 text-muted-foreground sm:flex-row">
          <p>Research prototype · use synthetic or properly de-identified data only.</p>
          <p className="flex items-center gap-1.5"><LockKeyhole className="size-3.5" /> Private storage · patient-scoped queries · audit events</p>
        </footer>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-foreground">
        {label}{required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}

function ConsentCheck({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm leading-5 text-foreground">
      <input
        type="checkbox"
        required
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 accent-blue-700"
      />
      <span>{children}</span>
    </label>
  );
}

function SafetyReviewCard({ review, title }: { review: WoundSafetyReview; title: string }) {
  const tone = triageTone[review.level];
  const Icon = tone.icon;
  return (
    <article className={`rounded-3xl border ${tone.border} ${tone.background} p-5 shadow-sm sm:p-6`}>
      <div className="flex items-start gap-4">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-card/80 ${tone.text}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-bold uppercase tracking-[0.12em] ${tone.text}`}>{title}</p>
          <h2 className={`mt-1 text-xl font-semibold tracking-tight ${tone.text}`}>{review.label}</h2>
          <p className={`mt-2 text-sm leading-6 ${tone.text}`}>{review.action}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className={`text-xs font-bold uppercase tracking-wide ${tone.text}`}>Why it was flagged</h3>
              <ul className={`mt-2 space-y-1.5 text-sm leading-5 ${tone.text}`}>
                {review.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
              </ul>
            </div>
            <div>
              <h3 className={`text-xs font-bold uppercase tracking-wide ${tone.text}`}>Known limits</h3>
              <ul className={`mt-2 space-y-1.5 text-sm leading-5 ${tone.text}`}>
                {review.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function AssessmentCard({ woundCase, assessment }: { woundCase: WoundCase; assessment: Assessment }) {
  const tone = triageTone[assessment.triage_level];
  const Icon = tone.icon;
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative aspect-[4/3] bg-slate-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assessment.image_url} alt={`Wound assessment for ${woundCase.label}`} className="size-full object-contain" />
        <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border bg-card/95 px-2.5 py-1 text-xs font-semibold shadow-sm ${tone.border} ${tone.text}`}>
          <Icon className="size-3.5" /> {assessment.safety_review.label}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{woundCase.label}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{woundCase.body_location} · {formatDate(assessment.captured_at)}</p>
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">Pain {assessment.pain_score}/10</span>
        </div>
        {assessment.notes && <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{assessment.notes}</p>}
        <details className="mt-3 rounded-xl border border-border bg-muted p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-foreground">
            Review details <ChevronRight className="size-3.5" />
          </summary>
          <div className="mt-3 space-y-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
            <p>{assessment.safety_review.action}</p>
            <ul className="space-y-1">
              {assessment.safety_review.reasons.map((reason) => <li key={reason}>• {reason}</li>)}
            </ul>
          </div>
        </details>
      </div>
    </article>
  );
}
