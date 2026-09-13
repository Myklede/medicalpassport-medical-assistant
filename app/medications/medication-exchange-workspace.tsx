'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  CircleAlert,
  ExternalLink,
  Info,
  Pill,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
} from 'lucide-react';

import Link from '@/components/app-link';
import MediPassBrand from '@/components/medipass-brand';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  COUNTRIES,
  dailyMedSearchUrl,
  labelForAccess,
  MEDICATION_EXCHANGES,
  medicationSearchText,
  METHODOLOGY_SOURCES,
  pairReview,
  type AccessClass,
  type CountryCode,
  type CountryMedication,
  type MedicationExchange,
} from '@/lib/medication-exchange';

type AccessFilter = 'all' | AccessClass;
const countryCodes = Object.keys(COUNTRIES) as CountryCode[];

const accessStyles: Record<AccessClass, string> = {
  otc: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
  rx: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200',
  verify:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
};

export function MedicationExchangeWorkspace() {
  const [from, setFrom] = useState<CountryCode>('VN');
  const [to, setTo] = useState<CountryCode>('US');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AccessFilter>('all');
  const [selectedId, setSelectedId] = useState('paracetamol');

  const normalizedQuery = query
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  const results = useMemo(
    () =>
      MEDICATION_EXCHANGES.filter(
        (medication) =>
          (filter === 'all' || medication.products[from].access === filter) &&
          (!normalizedQuery ||
            medicationSearchText(medication).includes(normalizedQuery)),
      ),
    [filter, from, normalizedQuery],
  );
  const selected =
    results.find((item) => item.id === selectedId) ?? results[0] ?? null;

  function changeFrom(next: CountryCode) {
    if (next === to) setTo(from);
    setFrom(next);
  }
  function changeTo(next: CountryCode) {
    if (next === from) setFrom(to);
    setTo(next);
  }
  function swapCountries() {
    setFrom(to);
    setTo(from);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/patient"
            className="grid size-11 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
            aria-label="Trở lại MediPass"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/" className="flex min-h-11 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-primary" aria-label="MediPass · Trang chủ"><MediPassBrand compact subtitle="MEDICATION PASSPORT" /></Link>
          <div className="ml-auto hidden items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200 sm:flex">
            <ShieldCheck className="size-3.5" /> 20 nhóm thuốc demo
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <div
            className="rounded-3xl bg-[#0F172A] p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8"
            data-annotate="medication-exchange-intro"
            data-annotation-label="Giới thiệu đối chiếu thuốc"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-300/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-blue-200">
                Research demo
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                Việt Nam · Ấn Độ · Mỹ · Trung Quốc
              </span>
            </div>
            <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Tìm ứng viên cùng hoạt chất, không tự kết luận “thuốc thay thế”.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Tên thương mại chỉ là điểm bắt đầu. Kết quả an toàn phải khớp hoạt
              chất, muối, hàm lượng, dạng và đường dùng, cơ chế giải phóng, nhãn
              Rx/OTC và tá dược của đúng sản phẩm.
            </p>
          </div>

          <article className="rounded-3xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-400/20 dark:bg-amber-400/10">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <ShieldAlert className="size-5" />
              <h2 className="font-semibold">
                Không dùng để tự đổi thuốc hoặc tự đổi liều
              </h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-amber-950/80 dark:text-amber-100/80">
              Tình trạng lưu hành và Rx/OTC có thể thay đổi theo hàm lượng, dạng
              bào chế và địa phương. Hãy mang vỏ hộp/đơn thuốc và danh sách dị
              ứng để pharmacist kiểm tra trước khi mua.
            </p>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-white/70 p-3 text-xs leading-5 text-amber-950 dark:border-amber-300/20 dark:bg-slate-950/20 dark:text-amber-100">
              Thuốc kê đơn, kháng sinh, insulin, thuốc tuyến giáp và ống hít
              luôn cần kế hoạch từ người kê đơn khi chuyển quốc gia.
            </div>
          </article>
        </section>

        <section
          className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card sm:p-6"
          data-annotate="medication-country-selector"
          data-annotation-label="Chọn quốc gia đối chiếu"
        >
          <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr]">
            <CountrySelect
              id="country-from"
              label="Quốc gia hiện tại"
              value={from}
              onChange={changeFrom}
            />
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={swapCountries}
              className="mb-0.5 justify-self-center rounded-xl"
              aria-label="Đổi chiều hai quốc gia"
            >
              <ArrowLeftRight />
            </Button>
            <CountrySelect
              id="country-to"
              label="Quốc gia đích đến"
              value={to}
              onChange={changeTo}
            />
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 dark:border-white/10 lg:flex-row lg:items-center">
            <label htmlFor="medication-search" className="relative flex-1">
              <span className="sr-only">Tìm thuốc theo tên hoặc hoạt chất</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="medication-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm Panadol, Tylenol, paracetamol…"
                className="h-11 rounded-xl bg-white pl-10 text-base dark:bg-slate-950/30"
              />
            </label>
            <div
              className="flex flex-wrap gap-2"
              aria-label="Lọc theo phân loại tại quốc gia hiện tại"
            >
              {(
                [
                  ['all', 'Tất cả'],
                  ['otc', 'OTC'],
                  ['rx', 'Rx'],
                  ['verify', 'Cần xác minh'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  aria-pressed={filter === value}
                  className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-primary ${filter === value ? 'border-primary bg-primary text-white' : 'border-border bg-card text-muted-foreground hover:border-blue-300 dark:hover:border-blue-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(330px,0.7fr)_minmax(0,1.3fr)]">
          <section
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-card"
            aria-label="Danh sách thuốc demo"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-sm font-semibold">
                  Thuốc tại {COUNTRIES[from].name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {results.length} trong 20 nhóm demo
                </p>
              </div>
              <Pill className="size-5 text-blue-700 dark:text-blue-300" />
            </div>
            <div className="max-h-[760px] space-y-2 overflow-y-auto p-3">
              {results.map((medication) => {
                const source = medication.products[from];
                const target = medication.products[to];
                const active = selected?.id === medication.id;
                return (
                  <button
                    key={medication.id}
                    type="button"
                    onClick={() => setSelectedId(medication.id)}
                    aria-pressed={active}
                    className={`w-full rounded-2xl border p-4 text-left transition ${active ? 'border-blue-500 bg-blue-50 shadow-sm dark:border-blue-300/50 dark:bg-blue-300/10' : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-white/10 dark:hover:bg-white/5'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {source.exampleName}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          {medication.inn} · {medication.atc}
                        </p>
                      </div>
                      <AccessBadge product={source} country={from} compact />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate">
                        {COUNTRIES[to].flag} {target.exampleName}
                      </span>
                      <ArrowLeftRight className="ml-auto size-3.5 shrink-0 text-blue-600 dark:text-blue-300" />
                    </div>
                  </button>
                );
              })}
              {!results.length && (
                <div className="px-5 py-14 text-center">
                  <Search className="mx-auto size-7 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold">
                    Không tìm thấy thuốc
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Thử tên thương mại, hoạt chất hoặc bỏ bộ lọc.
                  </p>
                </div>
              )}
            </div>
          </section>

          {selected ? (
            <MedicationDetail medication={selected} from={from} to={to} />
          ) : (
            <section className="grid min-h-72 place-items-center rounded-3xl border border-dashed border-slate-300 p-8 text-center dark:border-white/15">
              <p className="text-sm text-slate-500">
                Chọn một thuốc để xem đối chiếu.
              </p>
            </section>
          )}
        </div>

        <Methodology />
        <footer className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-card dark:text-slate-300">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <p>
              <strong className="text-slate-900 dark:text-white">
                Disclaimer:
              </strong>{' '}
              Đây là dữ liệu giả lập có tuyển chọn cho nghiên cứu UX, không phải
              danh mục lưu hành thời gian thực, chẩn đoán, đơn thuốc hay khuyến
              nghị mua thuốc. Không mang thuốc qua biên giới hoặc thay đơn chỉ
              dựa vào màn hình này. Luôn xác minh với pharmacist tại quốc gia
              đích; với thuốc Rx, liên hệ người kê đơn để có đơn và kế hoạch
              chuyển đổi phù hợp.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}

function CountrySelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: CountryCode;
  onChange: (value: CountryCode) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-blue-800 dark:text-blue-300">
        {label}
      </span>
      <NativeSelect
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as CountryCode)}
        className="w-full"
      >
        <>
          {countryCodes.map((code) => (
            <NativeSelectOption key={code} value={code}>
              {COUNTRIES[code].flag} {COUNTRIES[code].name}
            </NativeSelectOption>
          ))}
        </>
      </NativeSelect>
    </label>
  );
}

function AccessBadge({
  product,
  country,
  compact = false,
}: {
  product: CountryMedication;
  country: CountryCode;
  compact?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={`${accessStyles[product.access]} ${compact ? 'max-w-36 truncate px-2 py-1 text-[11px]' : 'h-auto px-2.5 py-1 text-xs'}`}
    >
      {labelForAccess(product.access, country)}
    </Badge>
  );
}

function MedicationDetail({
  medication,
  from,
  to,
}: {
  medication: MedicationExchange;
  from: CountryCode;
  to: CountryCode;
}) {
  const review = pairReview(medication, from, to);
  const source = medication.products[from];
  const target = medication.products[to];
  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card sm:p-7"
      data-annotate={`medication-${medication.id}`}
      data-annotation-label={`Đối chiếu thuốc ${medication.inn}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
            Hoạt chất chuẩn · ATC {medication.atc}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            {medication.inn}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {medication.purpose}
          </p>
        </div>
        <Badge
          variant="outline"
          className="h-auto border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200"
        >
          <ShieldCheck />
          Cùng hoạt chất
        </Badge>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        <ProductCard
          country={from}
          product={source}
          label="Đang dùng / đang tìm"
        />
        <div className="grid place-items-center">
          <span className="grid size-10 place-items-center rounded-full border border-slate-200 bg-slate-50 text-blue-700 dark:border-white/10 dark:bg-white/5 dark:text-blue-300">
            <ArrowLeftRight className="size-4" />
          </span>
        </div>
        <ProductCard
          country={to}
          product={target}
          label="Ứng viên tại điểm đến"
        />
      </div>

      <div
        className={`mt-4 rounded-2xl border p-4 ${review.sameStrength && review.sameForm ? 'border-blue-200 bg-blue-50 dark:border-blue-400/20 dark:bg-blue-400/10' : 'border-amber-200 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/10'}`}
      >
        <p className="flex items-start gap-2 text-sm font-semibold">
          <Info className="mt-0.5 size-4 shrink-0" />
          {review.summary}
        </p>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <ReviewLine
            ok
            label="Hoạt chất chuẩn (INN)"
            value="Khớp trong demo"
          />
          <ReviewLine
            ok={review.sameStrength}
            label="Hàm lượng ghi nhãn"
            value={
              review.sameStrength
                ? 'Mô tả giống nhau'
                : 'Khác — cần quy đổi chuyên môn'
            }
          />
          <ReviewLine
            ok={review.sameForm}
            label="Dạng/đường dùng"
            value={review.sameForm ? 'Mô tả giống nhau' : 'Khác — không tự đổi'}
          />
          <ReviewLine
            ok={!review.accessChanged}
            label="Rx/OTC"
            value={
              review.accessChanged
                ? 'Phân loại thay đổi'
                : 'Cùng nhóm trong demo'
            }
          />
          <ReviewLine
            warning
            label="Tá dược & sinh khả dụng"
            value="Chưa xác nhận — đọc đúng nhãn"
          />
          <ReviewLine
            warning
            label="Kết luận thay thế"
            value="Pharmacist/người kê đơn quyết định"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-400/20 dark:bg-rose-400/10">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200">
            <TriangleAlert className="size-4" />
            <h3 className="text-sm font-semibold">Cảnh báo hoạt chất</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-rose-950/75 dark:text-rose-100/75">
            {medication.safetyNote}
          </p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-400/20 dark:bg-amber-400/10">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <CircleAlert className="size-4" />
            <h3 className="text-sm font-semibold">Tá dược cần đối chiếu</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-950/75 dark:text-amber-100/75">
            {medication.excipientWatch}
          </p>
        </article>
      </div>

      <article className="mt-4 rounded-2xl border border-slate-200 p-5 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Stethoscope className="size-4 text-blue-700 dark:text-blue-300" />
          <h3 className="text-sm font-semibold">
            Hỏi pharmacist trước khi mua
          </h3>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          {medication.pharmacistChecks.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-300" />
              {item}
            </li>
          ))}
        </ul>
        <blockquote className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-950/30 dark:text-slate-200">
          “Tôi đang dùng <strong>{source.exampleName}</strong>. Xin kiểm tra{' '}
          <strong>{target.exampleName}</strong> có cùng hoạt chất, hàm lượng,
          dạng/đường dùng và cơ chế giải phóng không; đồng thời đối chiếu tá
          dược với dị ứng của tôi.”
        </blockquote>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={dailyMedSearchUrl(medication.inn)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
          >
            Tra nhãn DailyMed <ExternalLink className="size-3.5" />
          </a>
          <a
            href={COUNTRIES[to].registryUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
          >
            Kiểm tra {COUNTRIES[to].regulator}{' '}
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </article>
    </section>
  );
}

function ProductCard({
  country,
  product,
  label,
}: {
  country: CountryCode;
  product: CountryMedication;
  label: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-950/20">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">
          {COUNTRIES[country].flag}
        </span>
        <div>
          <h3 className="font-semibold">{COUNTRIES[country].name}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {COUNTRIES[country].regulator}
          </p>
        </div>
      </div>
      <p className="mt-4 text-lg font-semibold tracking-[-0.02em]">
        {product.exampleName}
      </p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {product.localIngredient}
      </p>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Hàm lượng</dt>
          <dd className="text-right font-medium">{product.strength}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Dạng dùng</dt>
          <dd className="max-w-[65%] text-right font-medium">{product.form}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <AccessBadge product={product} country={country} />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {product.accessNote}
      </p>
    </article>
  );
}

function ReviewLine({
  ok = false,
  warning = false,
  label,
  value,
}: {
  ok?: boolean;
  warning?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-white/70 p-3 dark:bg-slate-950/20">
      {warning ? (
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
      ) : ok ? (
        <Check className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-300" />
      ) : (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
      )}
      <span>
        <b className="block font-semibold">{label}</b>
        <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
          {value}
        </span>
      </span>
    </div>
  );
}

function Methodology() {
  const steps = [
    [
      '1',
      'Nhận dạng đúng sản phẩm',
      'Chụp/đọc tên, nhà sản xuất, số đăng ký và toàn bộ hoạt chất; không đoán từ màu viên.',
    ],
    [
      '2',
      'Chuẩn hóa hoạt chất',
      'Dùng INN; ghi rõ muối/ester và thuốc phối hợp. ATC chỉ hỗ trợ phân nhóm.',
    ],
    [
      '3',
      'Khớp cấu hình liều',
      'So hàm lượng, dạng, đường dùng, IR/XR/ER, thiết bị và đơn vị dose.',
    ],
    [
      '4',
      'Kiểm tra quốc gia đích',
      'Tra cơ quan quản lý để xác nhận lưu hành và Rx/OTC của đúng sản phẩm.',
    ],
    [
      '5',
      'Đọc nhãn & tá dược',
      'So chống chỉ định, tương tác, dị ứng và inactive ingredients của hai nhãn.',
    ],
    [
      '6',
      'Chuyên gia xác nhận',
      'Pharmacist xác minh sản phẩm; người kê đơn quyết định chuyển thuốc Rx/liều.',
    ],
  ];
  return (
    <section
      className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-card sm:p-7"
      data-annotate="medication-methodology"
      data-annotation-label="Quy trình đối chiếu thuốc"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
            Quy trình an toàn
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            Sáu bước trước khi coi hai sản phẩm là ứng viên đối chiếu
          </h2>
        </div>
        <Badge
          variant="outline"
          className="h-auto border-slate-200 px-3 py-1.5 dark:border-white/10"
        >
          <Info />
          Cập nhật demo: 10/09/2026
        </Badge>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {steps.map(([number, title, detail]) => (
          <article
            key={number}
            className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"
          >
            <span className="grid size-8 place-items-center rounded-xl bg-blue-50 text-xs font-bold text-blue-800 dark:bg-blue-400/10 dark:text-blue-200">
              {number}
            </span>
            <h3 className="mt-3 text-sm font-semibold">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {detail}
            </p>
          </article>
        ))}
      </div>
      <details className="mt-5 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
        <summary className="cursor-pointer text-sm font-semibold">
          Nguồn phương pháp và cơ quan quản lý
        </summary>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="space-y-2">
            {METHODOLOGY_SOURCES.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 text-blue-800 hover:underline dark:text-blue-300"
              >
                {source.label}
                <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
              </a>
            ))}
          </div>
          <div className="space-y-2">
            {countryCodes.map((code) => (
              <a
                key={code}
                href={COUNTRIES[code].registryUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 text-blue-800 hover:underline dark:text-blue-300"
              >
                {COUNTRIES[code].flag} {COUNTRIES[code].regulator}
                <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
              </a>
            ))}
          </div>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
          FDA Orange Book chỉ đánh giá tương đương trong hệ thống phê duyệt của
          Mỹ. RxNorm chuẩn hóa tên thuốc tại Mỹ. Không dùng hai nguồn này để tự
          suy ra tương đương pháp lý hoặc điều trị giữa các quốc gia.
        </p>
      </details>
    </section>
  );
}
