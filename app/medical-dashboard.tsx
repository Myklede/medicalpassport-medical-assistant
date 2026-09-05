'use client';

import {
  Activity,
  AlertCircle,
  Bell,
  Check,
  ChevronRight,
  CircleUserRound,
  ClipboardPlus,
  Cloud,
  Download,
  FileHeart,
  FileText,
  FlaskConical,
  Globe2,
  HeartPulse,
  Loader2,
  LockKeyhole,
  Menu,
  Paperclip,
  PenLine,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Trash2,
  TriangleAlert,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

type RecordType = 'allergy' | 'condition' | 'medication' | 'lab' | 'encounter';

type Patient = {
  id: string;
  display_name: string;
  birth_date: string | null;
  blood_type: string | null;
  preferred_language: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

type HealthRecord = {
  id: string;
  record_type: RecordType;
  fhir_resource_type: string;
  title: string;
  summary: string | null;
  status: string;
  clinical_date: string;
  provider: string | null;
  facility: string | null;
  country_code: string | null;
  code_system: string | null;
  code: string | null;
  source: string;
  verification_status: string;
  severity: string | null;
  details: Record<string, string>;
  attachment_id: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  attachment_byte_size: string | null;
  created_at: string;
  updated_at: string;
};

type DashboardData = {
  patient: Patient;
  user: { display_name: string };
  records: HealthRecord[];
  persistence: string;
};

type FormState = {
  record_type: RecordType;
  title: string;
  summary: string;
  status: string;
  clinical_date: string;
  provider: string;
  facility: string;
  country_code: string;
  code_system: string;
  code: string;
  source: string;
  verification_status: string;
  severity: string;
  attachment_id: string;
  details: Record<string, string>;
};

type ViewMode = 'overview' | 'records' | 'insurance';

const typeMeta = {
  allergy: {
    label: 'Allergy',
    plural: 'Allergies',
    icon: TriangleAlert,
    iconClass: 'bg-rose-50 text-rose-700',
    dotClass: 'bg-rose-600',
    codeSystem: 'SNOMED CT',
  },
  condition: {
    label: 'Condition',
    plural: 'Conditions',
    icon: FileHeart,
    iconClass: 'bg-amber-50 text-amber-700',
    dotClass: 'bg-amber-500',
    codeSystem: 'ICD-10-CM',
  },
  medication: {
    label: 'Medication',
    plural: 'Medications',
    icon: Pill,
    iconClass: 'bg-sky-50 text-sky-700',
    dotClass: 'bg-sky-600',
    codeSystem: 'RxNorm',
  },
  lab: {
    label: 'Lab result',
    plural: 'Lab results',
    icon: TestTube2,
    iconClass: 'bg-violet-50 text-violet-700',
    dotClass: 'bg-violet-600',
    codeSystem: 'LOINC',
  },
  encounter: {
    label: 'Visit',
    plural: 'Encounters',
    icon: ClipboardPlus,
    iconClass: 'bg-teal-50 text-teal-700',
    dotClass: 'bg-teal-600',
    codeSystem: '',
  },
} satisfies Record<RecordType, {
  label: string;
  plural: string;
  icon: typeof Activity;
  iconClass: string;
  dotClass: string;
  codeSystem: string;
}>;

const inputClass =
  'h-10 rounded-xl border-slate-200 bg-white px-3 focus-visible:border-teal-600 focus-visible:ring-teal-600/15';
const selectClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-3 focus:ring-teal-600/15';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700';

function cx(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
}) {
  return (
    <button
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition outline-none focus-visible:ring-3 focus-visible:ring-teal-600/20 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : size === 'lg' ? 'h-11 px-4' : 'h-9 px-3',
        variant === 'outline' && 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
        variant === 'destructive' && 'bg-rose-50 text-rose-700 hover:bg-rose-100',
        variant === 'default' && 'bg-slate-950 text-white hover:bg-slate-800',
        className,
      )}
      {...props}
    />
  );
}

function Badge({
  className,
  children,
}: HTMLAttributes<HTMLSpanElement> & { variant?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-5 w-fit items-center justify-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function NativeInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cx(
          'w-full min-w-0 border bg-transparent text-base outline-none transition placeholder:text-slate-400 disabled:opacity-50 md:text-sm',
          className,
        )}
        {...props}
      />
    );
  },
);

function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        'w-full border bg-transparent text-base outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-3 focus:ring-teal-600/15 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

function Dialog({
  open,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return <>{children}</>;
}

function DialogContent({
  className,
  children,
  onClose,
}: HTMLAttributes<HTMLElement> & { onClose?: () => void }) {
  useEffect(() => {
    if (!onClose) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        onClick={onClose}
        className="absolute inset-0 size-full bg-slate-950/35 backdrop-blur-sm"
      />
      <div className="pointer-events-none relative flex min-h-full items-center justify-center p-4">
        <dialog
          open
          className={cx(
            'pointer-events-auto relative m-0 w-full max-w-sm rounded-xl bg-white text-sm text-slate-900 shadow-2xl ring-1 ring-slate-950/10',
            className,
          )}
        >
          {children}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-teal-600/20"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>
          )}
        </dialog>
      </div>
    </div>
  );
}

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('flex flex-col gap-2', className)} {...props} />;
}

function DialogTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cx('font-heading text-base font-semibold', className)} {...props}>{children}</h2>;
}

function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx('text-sm text-slate-500', className)} {...props} />;
}

function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        'flex flex-col-reverse gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

function blankForm(recordType: RecordType = 'condition'): FormState {
  return {
    record_type: recordType,
    title: '',
    summary: '',
    status: 'active',
    clinical_date: new Date().toISOString().slice(0, 10),
    provider: '',
    facility: '',
    country_code: 'US',
    code_system: typeMeta[recordType].codeSystem,
    code: '',
    source: 'Self-reported',
    verification_status: 'self-reported',
    severity: '',
    attachment_id: '',
    details: {},
  };
}

function formFromRecord(record: HealthRecord): FormState {
  return {
    record_type: record.record_type,
    title: record.title,
    summary: record.summary ?? '',
    status: record.status,
    clinical_date: record.clinical_date.slice(0, 10),
    provider: record.provider ?? '',
    facility: record.facility ?? '',
    country_code: record.country_code ?? 'US',
    code_system: record.code_system ?? typeMeta[record.record_type].codeSystem,
    code: record.code ?? '',
    source: record.source,
    verification_status: record.verification_status,
    severity: record.severity ?? '',
    attachment_id: record.attachment_id ?? '',
    details: record.details ?? {},
  };
}

function formatDate(value: string | null | undefined, long = false) {
  if (!value) return 'Not recorded';
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: long ? 'long' : 'short',
    day: 'numeric',
    year: long ? 'numeric' : undefined,
    timeZone: 'UTC',
  }).format(date);
}

function formatBytes(value: string | null) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function titleForView(view: ViewMode, filter: RecordType | 'all') {
  if (view === 'overview') return 'Medical overview';
  if (view === 'insurance') return 'Insurance policy assistant';
  return filter === 'all' ? 'All medical records' : typeMeta[filter].plural;
}

export function MedicalDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RecordType | 'all'>('all');
  const [view, setView] = useState<ViewMode>('overview');
  const [formOpen, setFormOpen] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const [selected, setSelected] = useState<HealthRecord | null>(null);
  const [editing, setEditing] = useState<HealthRecord | null>(null);
  const [form, setForm] = useState<FormState>(() => blankForm());
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadRecords = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/records', { cache: 'no-store' });
      const payload = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Unable to load records.');
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRecords(), 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const records = useMemo(() => data?.records ?? [], [data?.records]);
  const counts = useMemo(
    () => ({
      allergy: records.filter((record) => record.record_type === 'allergy' && record.status === 'active').length,
      condition: records.filter((record) => record.record_type === 'condition' && record.status === 'active').length,
      medication: records.filter((record) => record.record_type === 'medication' && record.status === 'active').length,
      lab: records.filter((record) => record.record_type === 'lab').length,
    }),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((record) => {
      if (filter !== 'all' && record.record_type !== filter) return false;
      if (!normalized) return true;
      return [
        record.title,
        record.summary,
        record.provider,
        record.facility,
        record.code,
        record.source,
        JSON.stringify(record.details),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [records, filter, query]);

  const activeAllergies = records.filter(
    (record) => record.record_type === 'allergy' && record.status === 'active',
  );
  const activeConditions = records.filter(
    (record) => record.record_type === 'condition' && record.status === 'active',
  );
  const activeMedications = records.filter(
    (record) => record.record_type === 'medication' && record.status === 'active',
  );

  function showRecords(nextFilter: RecordType | 'all') {
    setView('records');
    setFilter(nextFilter);
    setMobileNav(false);
  }

  function openCreate(recordType: RecordType = 'condition') {
    setEditing(null);
    setForm(blankForm(recordType));
    setFile(null);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(record: HealthRecord) {
    setSelected(null);
    setEditing(record);
    setForm(formFromRecord(record));
    setFile(null);
    setFormError('');
    setFormOpen(true);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateDetail(key: string, value: string) {
    setForm((current) => ({
      ...current,
      details: { ...current.details, [key]: value },
    }));
  }

  function changeType(recordType: RecordType) {
    setForm((current) => ({
      ...current,
      record_type: recordType,
      code_system: typeMeta[recordType].codeSystem,
      details: {},
    }));
  }

  async function saveRecord(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      let attachmentId = form.attachment_id || null;
      if (file) {
        const uploadBody = new FormData();
        uploadBody.append('file', file);
        const uploadResponse = await fetch('/api/files', {
          method: 'POST',
          body: uploadBody,
        });
        const upload = (await uploadResponse.json()) as { id?: string; error?: string };
        if (!uploadResponse.ok || !upload.id) {
          throw new Error(upload.error || 'Attachment upload failed.');
        }
        attachmentId = upload.id;
      }

      const response = await fetch('/api/records', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          id: editing?.id,
          attachment_id: attachmentId,
        }),
      });
      const payload = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not save the record.');
      await loadRecords();
      setFormOpen(false);
      setEditing(null);
      setFile(null);
      setToast(editing ? 'Record updated.' : 'Health record saved to the database.');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not save the record.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(record: HealthRecord) {
    setDeleting(true);
    try {
      const response = await fetch('/api/records', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Could not delete the record.');
      setSelected(null);
      await loadRecords();
      setToast('Record removed from the active timeline.');
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : 'Could not delete the record.');
    } finally {
      setDeleting(false);
    }
  }

  const navItems: Array<{
    label: string;
    icon: typeof Activity;
    active: boolean;
    action: () => void;
    badge?: string;
  }> = [
    {
      label: 'Overview',
      icon: Activity,
      active: view === 'overview',
      action: () => {
        setView('overview');
        setFilter('all');
        setMobileNav(false);
      },
    },
    {
      label: 'Medical records',
      icon: FileHeart,
      active: view === 'records' && filter === 'all',
      action: () => showRecords('all'),
    },
    {
      label: 'Medications',
      icon: Pill,
      active: view === 'records' && filter === 'medication',
      action: () => showRecords('medication'),
    },
    {
      label: 'Lab results',
      icon: TestTube2,
      active: view === 'records' && filter === 'lab',
      action: () => showRecords('lab'),
    },
    {
      label: 'Insurance',
      icon: ShieldCheck,
      badge: 'Soon',
      active: view === 'insurance',
      action: () => {
        setView('insurance');
        setMobileNav(false);
      },
    },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileNav((current) => !current)}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 lg:hidden"
            aria-label={mobileNav ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNav}
          >
            {mobileNav ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setView('overview');
              setFilter('all');
            }}
            className="flex items-center gap-2.5"
            aria-label="Go to MediPass overview"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-teal-700 text-white shadow-sm shadow-teal-900/15">
              <HeartPulse className="size-5" strokeWidth={2.3} />
            </span>
            <span className="font-heading text-[17px] font-semibold tracking-[-0.025em] text-slate-950">
              MediPass
            </span>
          </button>
          <label htmlFor="desktop-record-search" className="relative ml-auto hidden w-full max-w-sm sm:block">
            <span className="sr-only">Search health history</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="desktop-record-search"
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => {
                if (view === 'insurance') setView('records');
              }}
              placeholder="Search your health history"
              className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-9 pr-14"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              ⌘ K
            </kbd>
          </label>
          <button
            type="button"
            onClick={() => setToast("You're all caught up — no demo notifications.")}
            aria-label="Notifications"
            className="ml-auto grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 sm:ml-0"
          >
            <Bell className="size-4" />
          </button>
          <div className="hidden items-center gap-2 border-l border-slate-200 pl-4 sm:flex">
            <span className="grid size-8 place-items-center rounded-full bg-teal-50 text-teal-800">
              <CircleUserRound className="size-5" />
            </span>
            <div className="max-w-36 leading-tight">
              <p className="truncate text-xs font-semibold text-slate-800">
                {data?.patient.display_name ?? 'Demo patient'}
              </p>
              <p className="text-[10px] text-slate-500">Patient workspace</p>
            </div>
          </div>
        </div>
        {mobileNav && (
          <nav className="border-t border-slate-100 bg-white p-3 shadow-lg lg:hidden" aria-label="Mobile navigation">
            <div className="grid gap-1 sm:grid-cols-2">
              {navItems.map(({ label, icon: Icon, active, action, badge }) => (
                <button
                  key={label}
                  type="button"
                  onClick={action}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium ${
                    active ? 'bg-teal-50 text-teal-900' : 'text-slate-600'
                  }`}
                >
                  <Icon className="size-[18px]" />
                  {label}
                  {badge && <span className="ml-auto text-[10px] text-slate-400">{badge}</span>}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <div className="mx-auto grid max-w-[1480px] lg:grid-cols-[236px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100vh-64px)] border-r border-slate-200/80 bg-white px-4 py-6 lg:flex lg:flex-col">
          <nav aria-label="Primary navigation" className="space-y-1">
            {navItems.map(({ label, icon: Icon, active, action, badge }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className={`flex w-full min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors ${
                  active
                    ? 'bg-teal-50 text-teal-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <Icon className="size-[18px]" />
                {label}
                {badge && (
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
            <div className="mb-3 grid size-8 place-items-center rounded-lg bg-white text-teal-700 shadow-sm">
              <Sparkles className="size-4" />
            </div>
            <p className="text-sm font-semibold text-slate-900">Your Medical Passport</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              A concise emergency summary you control.
            </p>
            <Button
              type="button"
              onClick={() => setPassportOpen(true)}
              className="mt-3 h-9 w-full bg-teal-700 hover:bg-teal-800"
              size="sm"
            >
              Preview summary
            </Button>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <div className="text-xs leading-5">
                <p className="font-semibold">Demo environment — fictional data only.</p>
                <p className="text-amber-900/75">
                  This prototype does not provide medical advice, diagnosis, or emergency care. In a U.S. emergency, call 911.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Badge className="mb-3 border-teal-200 bg-teal-50 text-teal-800" variant="outline">
                  <Cloud className="size-3" /> DATABASE CONNECTED
                </Badge>
                <h1 className="font-heading text-2xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-3xl">
                  {titleForView(view, filter)}
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
                  {view === 'overview'
                    ? 'Your portable health story, organized for the next care team that needs it.'
                    : view === 'insurance'
                      ? 'A source-grounded policy explainer is planned for the next research milestone.'
                      : `${filteredRecords.length} saved ${filteredRecords.length === 1 ? 'record' : 'records'} in this view.`}
                </p>
              </div>
              {view !== 'insurance' && (
                <Button
                  type="button"
                  onClick={() => openCreate(filter === 'all' ? 'condition' : filter)}
                  className="h-11 gap-2 self-start bg-teal-700 px-4 hover:bg-teal-800 sm:self-auto"
                >
                  <Plus className="size-4" />
                  Add health record
                </Button>
              )}
            </div>

            {error ? (
              <div className="mt-7 rounded-2xl border border-rose-200 bg-white p-8 text-center">
                <AlertCircle className="mx-auto size-8 text-rose-600" />
                <h2 className="mt-3 font-semibold text-slate-900">We could not load the database</h2>
                <p className="mt-1 text-sm text-slate-500">{error}</p>
                <Button type="button" onClick={() => void loadRecords()} className="mt-4" variant="outline">
                  <RefreshCw className="size-4" /> Retry
                </Button>
              </div>
            ) : loading ? (
              <div className="mt-10 flex items-center justify-center gap-3 text-sm text-slate-500">
                <Loader2 className="size-5 animate-spin text-teal-700" /> Loading your saved record…
              </div>
            ) : view === 'insurance' ? (
              <ComingSoonInsurance onBack={() => setView('overview')} />
            ) : (
              <>
                {view === 'overview' && (
                  <>
                    <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <StatCard
                        label="Known allergies"
                        count={counts.allergy}
                        detail={activeAllergies.map((item) => item.title).join(' · ') || 'None recorded'}
                        type="allergy"
                        important
                        onClick={() => showRecords('allergy')}
                      />
                      <StatCard
                        label="Active conditions"
                        count={counts.condition}
                        detail={activeConditions.map((item) => item.title).join(' · ') || 'None recorded'}
                        type="condition"
                        onClick={() => showRecords('condition')}
                      />
                      <StatCard
                        label="Current medications"
                        count={counts.medication}
                        detail="Medication list ready to reconcile"
                        type="medication"
                        onClick={() => showRecords('medication')}
                      />
                      <StatCard
                        label="Lab results"
                        count={counts.lab}
                        detail="Reported values; no automated diagnosis"
                        type="lab"
                        onClick={() => showRecords('lab')}
                      />
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
                      <RecordTimeline
                        records={filteredRecords.slice(0, 5)}
                        onSelect={setSelected}
                        onViewAll={() => showRecords('all')}
                        compact
                      />
                      <article className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg shadow-slate-950/10 sm:p-6">
                        <div className="flex items-center gap-2 text-teal-300">
                          <ClipboardPlus className="size-4" />
                          <p className="text-xs font-semibold uppercase tracking-[0.12em]">Safety summary</p>
                        </div>
                        <h2 className="mt-5 font-heading text-xl font-semibold tracking-tight">
                          Ready for an unexpected visit.
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          Critical facts are condensed into a clinician-friendly snapshot you control.
                        </p>
                        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 text-sm">
                          <div>
                            <dt className="text-xs text-slate-400">Blood type</dt>
                            <dd className="mt-1 font-semibold">{data?.patient.blood_type ?? 'Unknown'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-slate-400">Emergency contact</dt>
                            <dd className="mt-1 font-semibold">
                              {data?.patient.emergency_contact_name ? '1 on file' : 'Not recorded'}
                            </dd>
                          </div>
                        </dl>
                        <Button
                          type="button"
                          onClick={() => setPassportOpen(true)}
                          className="mt-5 h-10 w-full bg-white text-slate-950 hover:bg-slate-100"
                          size="lg"
                        >
                          Open Medical Passport
                        </Button>
                      </article>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">Quick add</p>
                          <h2 className="mt-1 font-heading text-base font-semibold text-slate-950">What happened in your care?</h2>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(typeMeta) as RecordType[]).map((type) => {
                            const Icon = typeMeta[type].icon;
                            return (
                              <Button key={type} type="button" onClick={() => openCreate(type)} variant="outline" className="h-10">
                                <Icon className="size-4" /> {typeMeta[type].label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {view === 'records' && (
                  <div className="mt-6">
                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
                      <label htmlFor="mobile-record-search" className="relative min-w-0 flex-1 sm:hidden">
                        <span className="sr-only">Search records</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="mobile-record-search"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Search records"
                          className="h-10 rounded-xl border-slate-200 pl-9"
                        />
                      </label>
                      <div className="flex flex-1 gap-1 overflow-x-auto pb-1 sm:pb-0">
                        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterButton>
                        {(Object.keys(typeMeta) as RecordType[]).map((type) => (
                          <FilterButton key={type} active={filter === type} onClick={() => setFilter(type)}>
                            {typeMeta[type].plural}
                          </FilterButton>
                        ))}
                      </div>
                      {(filter !== 'all' || query) && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setFilter('all');
                            setQuery('');
                          }}
                          className="h-9"
                        >
                          <X className="size-3.5" /> Clear filters
                        </Button>
                      )}
                    </div>
                    <div className="mt-4">
                      <RecordTimeline
                        records={filteredRecords}
                        onSelect={setSelected}
                        onViewAll={() => undefined}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-slate-200 py-5 text-[11px] leading-5 text-slate-500 sm:flex-row">
              <p>Prototype only · Do not enter real or identifiable health information.</p>
              <p className="flex items-center gap-1.5">
                <LockKeyhole className="size-3" /> Per-user server checks · audit trail · private file bucket
              </p>
            </footer>
          </div>
        </section>
      </div>

      <RecordFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        form={form}
        editing={editing}
        file={file}
        saving={saving}
        error={formError}
        onFileChange={setFile}
        onTypeChange={changeType}
        onUpdate={updateForm}
        onUpdateDetail={updateDetail}
        onSubmit={saveRecord}
      />

      <RecordDetailDialog
        record={selected}
        deleting={deleting}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        onDelete={deleteRecord}
      />

      <PassportDialog
        open={passportOpen}
        onOpenChange={setPassportOpen}
        patient={data?.patient ?? null}
        allergies={activeAllergies}
        conditions={activeConditions}
        medications={activeMedications}
      />

      {toast && (
        <output
          aria-live="polite"
          className="fixed bottom-4 left-1/2 z-[80] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm text-white shadow-2xl"
        >
          <Check className="size-4 text-teal-300" /> {toast}
        </output>
      )}
    </main>
  );
}

function StatCard({
  label,
  count,
  detail,
  type,
  important = false,
  onClick,
}: {
  label: string;
  count: number;
  detail: string;
  type: RecordType;
  important?: boolean;
  onClick: () => void;
}) {
  const Icon = typeMeta[type].icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-44 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-teal-600/20"
    >
      <div className="flex items-center justify-between">
        <span className={`grid size-9 place-items-center rounded-xl ${typeMeta[type].iconClass}`}>
          <Icon className="size-[18px]" />
        </span>
        {important && (
          <Badge className="bg-rose-50 text-rose-700" variant="secondary">Important</Badge>
        )}
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">{count}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 line-clamp-1 text-xs text-slate-500">{detail}</p>
      <span className="mt-3 inline-flex items-center text-xs font-semibold text-teal-700 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
        View records <ChevronRight className="size-3" />
      </span>
    </button>
  );
}

function RecordTimeline({
  records,
  onSelect,
  onViewAll,
  compact = false,
}: {
  records: HealthRecord[];
  onSelect: (record: HealthRecord) => void;
  onViewAll: () => void;
  compact?: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.03)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-heading text-base font-semibold text-slate-950">
            {compact ? 'Recent health timeline' : 'Health record timeline'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Visits, labs, medications, conditions, and safety alerts
          </p>
        </div>
        {compact && (
          <Button type="button" variant="ghost" size="sm" className="text-teal-800" onClick={onViewAll}>
            View all <ChevronRight className="size-3.5" />
          </Button>
        )}
      </div>
      {records.length ? (
        <div className="divide-y divide-slate-100">
          {records.map((record) => {
            const meta = typeMeta[record.record_type];
            const Icon = meta.icon;
            return (
              <button
                key={record.id}
                type="button"
                onClick={() => onSelect(record)}
                className="grid w-full grid-cols-[42px_minmax(0,1fr)_auto] items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50/80 focus-visible:bg-slate-50 focus-visible:outline-none sm:px-6"
              >
                <span className={`grid size-10 place-items-center rounded-xl ${meta.iconClass}`}>
                  <Icon className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">{record.title}</span>
                    <Badge variant="outline" className="h-5 bg-white text-[10px] text-slate-500">
                      {meta.label}
                    </Badge>
                    {record.attachment_id && <Paperclip className="size-3.5 text-slate-400" />}
                  </span>
                  <span className="mt-1 block line-clamp-1 text-xs leading-5 text-slate-500">
                    {record.summary || `${record.source} · ${record.status}`}
                  </span>
                  <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {record.provider || record.facility || record.source}
                  </span>
                </span>
                <span className="flex items-center gap-2 pt-1 text-xs font-medium text-slate-500">
                  <span className="hidden sm:inline">{formatDate(record.clinical_date)}</span>
                  <ChevronRight className="size-4 text-slate-300" />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="px-6 py-12 text-center">
          <Search className="mx-auto size-7 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-800">No records match this view</p>
          <p className="mt-1 text-xs text-slate-500">Try another type or clear your search.</p>
        </div>
      )}
    </article>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold transition ${
        active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function RecordFormDialog({
  open,
  onOpenChange,
  form,
  editing,
  file,
  saving,
  error,
  onFileChange,
  onTypeChange,
  onUpdate,
  onUpdateDetail,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormState;
  editing: HealthRecord | null;
  file: File | null;
  saving: boolean;
  error: string;
  onFileChange: (file: File | null) => void;
  onTypeChange: (type: RecordType) => void;
  onUpdate: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onUpdateDetail: (key: string, value: string) => void;
  onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => void;
}) {
  const meta = typeMeta[form.record_type];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader className="border-b border-slate-100 px-5 py-5 sm:px-6">
            <DialogTitle className="text-lg">{editing ? 'Edit health record' : 'Add a health record'}</DialogTitle>
            <DialogDescription>
              Use fictional or de-identified information only in this prototype.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label htmlFor="record-clinical-date">
                <span className={labelClass}>Record type</span>
                <select
                  className={selectClass}
                  value={form.record_type}
                  onChange={(event) => onTypeChange(event.target.value as RecordType)}
                >
                  {(Object.keys(typeMeta) as RecordType[]).map((type) => (
                    <option key={type} value={type}>{typeMeta[type].label}</option>
                  ))}
                </select>
              </label>
              <label htmlFor="record-clinical-date">
                <span className={labelClass}>Clinical date</span>
                <Input
                  id="record-clinical-date"
                  required
                  type="date"
                  value={form.clinical_date}
                  onChange={(event) => onUpdate('clinical_date', event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <label htmlFor="record-title">
              <span className={labelClass}>{meta.label} name</span>
              <Input
                id="record-title"
                required
                minLength={2}
                maxLength={160}
                value={form.title}
                onChange={(event) => onUpdate('title', event.target.value)}
                placeholder={placeholderForType(form.record_type)}
                className={inputClass}
              />
            </label>

            <label htmlFor="record-summary">
              <span className={labelClass}>Summary or care notes</span>
              <Textarea
                id="record-summary"
                value={form.summary}
                maxLength={2000}
                onChange={(event) => onUpdate('summary', event.target.value)}
                placeholder="What should a future care team know?"
                className="min-h-24 rounded-xl border-slate-200 px-3"
              />
            </label>

            <TypeSpecificFields form={form} onUpdateDetail={onUpdateDetail} />

            <div className="grid gap-4 sm:grid-cols-3">
              <label htmlFor="record-provider">
                <span className={labelClass}>Status</span>
                <select className={selectClass} value={form.status} onChange={(event) => onUpdate('status', event.target.value)}>
                  <option value="active">Active</option>
                  <option value="final">Final</option>
                  <option value="finished">Finished</option>
                  <option value="inactive">Inactive</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
              <label>
                <span className={labelClass}>Severity</span>
                <select className={selectClass} value={form.severity} onChange={(event) => onUpdate('severity', event.target.value)}>
                  <option value="">Not entered</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label>
                <span className={labelClass}>Country</span>
                <select className={selectClass} value={form.country_code} onChange={(event) => onUpdate('country_code', event.target.value)}>
                  <option value="US">United States</option>
                  <option value="VN">Vietnam</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label htmlFor="record-provider">
                <span className={labelClass}>Provider</span>
                <Input id="record-provider" value={form.provider} onChange={(event) => onUpdate('provider', event.target.value)} placeholder="Clinician name" className={inputClass} />
              </label>
              <label htmlFor="record-facility">
                <span className={labelClass}>Facility</span>
                <Input id="record-facility" value={form.facility} onChange={(event) => onUpdate('facility', event.target.value)} placeholder="Clinic or hospital" className={inputClass} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Source</span>
                <select className={selectClass} value={form.source} onChange={(event) => onUpdate('source', event.target.value)}>
                  <option>Self-reported</option>
                  <option>Provider document</option>
                  <option>Imported record</option>
                  <option>Unknown source</option>
                </select>
              </label>
              <label>
                <span className={labelClass}>Verification</span>
                <select className={selectClass} value={form.verification_status} onChange={(event) => onUpdate('verification_status', event.target.value)}>
                  <option value="self-reported">Self-reported</option>
                  <option value="unverified">Unverified</option>
                  <option value="verified">Verified by provider</option>
                </select>
              </label>
            </div>

            <details className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <summary className="cursor-pointer text-xs font-semibold text-slate-700">Advanced coding details</summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label htmlFor="record-code-system">
                  <span className={labelClass}>Code system</span>
                  <Input id="record-code-system" value={form.code_system} onChange={(event) => onUpdate('code_system', event.target.value)} placeholder="ICD-10-CM, LOINC, RxNorm…" className={inputClass} />
                </label>
                <label htmlFor="record-code">
                  <span className={labelClass}>Code</span>
                  <Input id="record-code" value={form.code} onChange={(event) => onUpdate('code', event.target.value)} placeholder="Optional standardized code" className={inputClass} />
                </label>
              </div>
            </details>

            <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-teal-500 hover:bg-teal-50/40">
              <UploadCloud className="mx-auto size-6 text-teal-700" />
              <span className="mt-2 block text-sm font-semibold text-slate-800">
                {file?.name || (editing?.attachment_name ? `Keep ${editing.attachment_name}` : 'Attach a PDF or image')}
              </span>
              <span className="mt-1 block text-xs text-slate-500">PDF, JPEG, or PNG · up to 8 MB · private object storage</span>
              <input
                className="sr-only"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <DialogFooter className="sticky bottom-0 mx-0 mb-0 rounded-none rounded-b-xl bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="h-10">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="h-10 bg-teal-700 px-5 hover:bg-teal-800">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Cloud className="size-4" />}
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save to database'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TypeSpecificFields({
  form,
  onUpdateDetail,
}: {
  form: FormState;
  onUpdateDetail: (key: string, value: string) => void;
}) {
  if (form.record_type === 'allergy') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <DetailInput label="Reaction" value={form.details.reaction} onChange={(value) => onUpdateDetail('reaction', value)} placeholder="e.g. hives" />
        <DetailInput label="Category" value={form.details.category} onChange={(value) => onUpdateDetail('category', value)} placeholder="Medication, food, environment" />
      </div>
    );
  }
  if (form.record_type === 'medication') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <DetailInput label="Active ingredient" value={form.details.ingredient} onChange={(value) => onUpdateDetail('ingredient', value)} placeholder="Generic ingredient" />
        <DetailInput label="Strength" value={form.details.strength} onChange={(value) => onUpdateDetail('strength', value)} placeholder="e.g. 10 mg" />
        <DetailInput label="Dose" value={form.details.dose} onChange={(value) => onUpdateDetail('dose', value)} placeholder="e.g. one tablet" />
        <DetailInput label="Frequency" value={form.details.frequency} onChange={(value) => onUpdateDetail('frequency', value)} placeholder="e.g. once daily" />
      </div>
    );
  }
  if (form.record_type === 'lab') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <DetailInput label="Entered result" value={form.details.value} onChange={(value) => onUpdateDetail('value', value)} placeholder="e.g. 13.7" />
        <DetailInput label="Unit" value={form.details.unit} onChange={(value) => onUpdateDetail('unit', value)} placeholder="e.g. g/dL" />
        <DetailInput label="Reported reference range" value={form.details.referenceRange} onChange={(value) => onUpdateDetail('referenceRange', value)} placeholder="e.g. 12.0–16.0" />
        <DetailInput label="Specimen" value={form.details.specimen} onChange={(value) => onUpdateDetail('specimen', value)} placeholder="e.g. blood" />
      </div>
    );
  }
  if (form.record_type === 'encounter') {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <DetailInput label="Visit type" value={form.details.visitType} onChange={(value) => onUpdateDetail('visitType', value)} placeholder="Primary care, urgent care…" />
        <DetailInput label="Follow-up plan" value={form.details.followUp} onChange={(value) => onUpdateDetail('followUp', value)} placeholder="Next step from the visit" />
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DetailInput label="Condition category" value={form.details.category} onChange={(value) => onUpdateDetail('category', value)} placeholder="Congenital, chronic, acquired…" />
      <DetailInput label="Diagnosis verification" value={form.details.verification} onChange={(value) => onUpdateDetail('verification', value)} placeholder="Confirmed, provisional…" />
    </div>
  );
}

function DetailInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const inputId = useId();
  return (
    <label htmlFor={inputId}>
      <span className={labelClass}>{label}</span>
      <Input id={inputId} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={inputClass} />
    </label>
  );
}

function placeholderForType(type: RecordType) {
  return {
    allergy: 'e.g. Penicillin',
    condition: 'e.g. Essential hypertension',
    medication: 'e.g. Lisinopril 10 mg',
    lab: 'e.g. Hemoglobin',
    encounter: 'e.g. Annual wellness visit',
  }[type];
}

function RecordDetailDialog({
  record,
  deleting,
  onClose,
  onEdit,
  onDelete,
}: {
  record: HealthRecord | null;
  deleting: boolean;
  onClose: () => void;
  onEdit: (record: HealthRecord) => void;
  onDelete: (record: HealthRecord) => void;
}) {
  if (!record) return null;
  const meta = typeMeta[record.record_type];
  const Icon = meta.icon;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent onClose={onClose} className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3 pr-8">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${meta.iconClass}`}>
              <Icon className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg leading-6">{record.title}</DialogTitle>
              <DialogDescription className="mt-1">
                {meta.label} · {formatDate(record.clinical_date, true)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {record.summary && (
            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{record.summary}</div>
          )}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Status" value={record.status} />
            <Detail label="Verification" value={record.verification_status} />
            <Detail label="Provider" value={record.provider || 'Not entered'} />
            <Detail label="Facility" value={record.facility || 'Not entered'} />
            <Detail label="Country" value={record.country_code || 'Not entered'} />
            <Detail label="Source" value={record.source} />
            {record.severity && <Detail label="Severity" value={record.severity} />}
            {record.code && <Detail label={record.code_system || 'Code'} value={record.code} />}
          </dl>
          {Object.keys(record.details ?? {}).length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Record details</p>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {Object.entries(record.details).map(([key, value]) => (
                  <Detail key={key} label={key.replace(/([A-Z])/g, ' $1')} value={String(value)} />
                ))}
              </dl>
            </div>
          )}
          {record.attachment_id && (
            <a
              href={`/api/files?id=${encodeURIComponent(record.attachment_id)}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm transition hover:bg-slate-50"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-slate-600">
                <FileText className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-800">{record.attachment_name}</span>
                <span className="text-xs text-slate-500">{formatBytes(record.attachment_byte_size)} · private attachment</span>
              </span>
              <Download className="size-4 text-teal-700" />
            </a>
          )}
          <p className="text-[11px] text-slate-400">Last updated {formatDate(record.updated_at, true)} · audit event recorded</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="destructive" disabled={deleting} onClick={() => onDelete(record)}>
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Remove
          </Button>
          <Button type="button" variant="outline" onClick={() => onEdit(record)}>
            <PenLine className="size-4" /> Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 capitalize text-slate-800">{value}</dd>
    </div>
  );
}

function PassportDialog({
  open,
  onOpenChange,
  patient,
  allergies,
  conditions,
  medications,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient | null;
  allergies: HealthRecord[];
  conditions: HealthRecord[];
  medications: HealthRecord[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
        <div className="bg-slate-950 px-6 py-6 text-white">
          <div className="flex items-center gap-2 text-teal-300">
            <HeartPulse className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em]">MediPass clinical summary</span>
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">{patient?.display_name ?? 'Demo patient'}</h2>
          <p className="mt-1 text-sm text-slate-300">
            DOB {formatDate(patient?.birth_date, true)} · Blood type {patient?.blood_type ?? 'unknown'}
          </p>
        </div>
        <div className="space-y-5 px-6 py-5">
          <SummarySection title="Allergy alerts" icon={TriangleAlert} items={allergies} empty="No active allergies recorded" tone="rose" />
          <SummarySection title="Active conditions" icon={FileHeart} items={conditions} empty="No active conditions recorded" tone="amber" />
          <SummarySection title="Current medications" icon={Pill} items={medications} empty="No active medications recorded" tone="sky" />
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <Detail label="Emergency contact" value={patient?.emergency_contact_name ?? 'Not recorded'} />
            <Detail label="Phone" value={patient?.emergency_contact_phone ?? 'Not recorded'} />
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            Synthetic demo summary. Clinicians must verify all entries before making care decisions.
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-none rounded-b-xl px-6">
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Download className="size-4" /> Print / save PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummarySection({
  title,
  icon: Icon,
  items,
  empty,
  tone,
}: {
  title: string;
  icon: typeof Activity;
  items: HealthRecord[];
  empty: string;
  tone: 'rose' | 'amber' | 'sky';
}) {
  const tones = {
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
  };
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className={`grid size-7 place-items-center rounded-lg ${tones[tone]}`}><Icon className="size-3.5" /></span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="rounded-xl border border-slate-200">
        {items.length ? items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
            <div>
              <p className="text-sm font-semibold text-slate-800">{item.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.summary || item.source}</p>
            </div>
            {item.severity && <Badge variant="outline" className="capitalize">{item.severity}</Badge>}
          </div>
        )) : <p className="px-4 py-3 text-sm text-slate-500">{empty}</p>}
      </div>
    </section>
  );
}

function ComingSoonInsurance({ onBack }: { onBack: () => void }) {
  return (
    <div className="mt-7 overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div>
          <Badge className="bg-violet-50 text-violet-700" variant="secondary">RESEARCH ROADMAP</Badge>
          <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-slate-950">
            Explain policy language with its source attached.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The planned module will ingest an SBC or policy PDF, retrieve the relevant clause, and explain deductibles, copays, coinsurance, networks, and prior authorization with page citations. It will not promise coverage or final cost.
          </p>
          <Button type="button" onClick={onBack} variant="outline" className="mt-5 h-10">
            Back to working demo
          </Button>
        </div>
        <div className="rounded-2xl bg-slate-950 p-5 text-white">
          <div className="grid gap-3">
            {[
              ['1', 'Private policy upload'],
              ['2', 'Structured text and table extraction'],
              ['3', 'Source-grounded retrieval'],
              ['4', 'Plain-language answer with page citation'],
            ].map(([number, label]) => (
              <div key={number} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="grid size-7 place-items-center rounded-lg bg-teal-400/15 text-xs font-bold text-teal-300">{number}</span>
                <span className="text-sm text-slate-200">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid border-t border-slate-100 sm:grid-cols-3">
        <RoadmapItem icon={FlaskConical} title="Wound monitoring" text="Longitudinal RGB capture and segmentation research." />
        <RoadmapItem icon={Activity} title="Physical therapy" text="On-device pose tracking and progress summaries." />
        <RoadmapItem icon={Globe2} title="Global medication map" text="Ingredient-first candidates for pharmacist review." />
      </div>
    </div>
  );
}

function RoadmapItem({ icon: Icon, title, text }: { icon: typeof Activity; title: string; text: string }) {
  return (
    <div className="border-b border-slate-100 p-5 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <Icon className="size-4 text-teal-700" />
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}
