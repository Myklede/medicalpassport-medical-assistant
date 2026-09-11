import fontkit from '@pdf-lib/fontkit';
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from 'pdf-lib';
import type { FhirBundle, IpsSnapshot } from './ips.ts';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const INK = rgb(0.08, 0.2, 0.23);
const MUTED = rgb(0.36, 0.47, 0.5);
const TEAL = rgb(0.04, 0.45, 0.4);
const TEAL_DARK = rgb(0.03, 0.3, 0.29);
const LIGHT_TEAL = rgb(0.92, 0.97, 0.96);
const BORDER = rgb(0.82, 0.88, 0.89);
const LIGHT = rgb(0.97, 0.98, 0.98);
const ROSE = rgb(0.98, 0.93, 0.9);
const ROSE_INK = rgb(0.55, 0.23, 0.12);
const AMBER = rgb(0.99, 0.96, 0.84);
const AMBER_INK = rgb(0.47, 0.32, 0.06);

type PdfContext = {
  document: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
};

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function humanDate(value: string | null | undefined): string {
  if (!value) return 'Not recorded / Chưa ghi nhận';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function splitLongToken(
  token: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  if (font.widthOfTextAtSize(token, size) <= width) return [token];
  const parts: string[] = [];
  let current = '';
  for (const char of token) {
    if (current && font.widthOfTextAtSize(current + char, size) > width) {
      parts.push(current);
      current = char;
    } else current += char;
  }
  if (current) parts.push(current);
  return parts;
}

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const words = clean(text)
    .split(' ')
    .flatMap((word) => splitLongToken(word, font, size, width));
  if (!words.length) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function addPage(context: PdfContext): void {
  context.page = context.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  context.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 7,
    width: PAGE_WIDTH,
    height: 7,
    color: TEAL,
  });
  context.page.drawText('MediPass  /  INTERNATIONAL PATIENT SUMMARY', {
    x: MARGIN,
    y: PAGE_HEIGHT - 34,
    font: context.bold,
    size: 8,
    color: TEAL_DARK,
  });
  context.page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - 43 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 43 },
    thickness: 0.7,
    color: BORDER,
  });
  context.y = PAGE_HEIGHT - 62;
}

function ensureSpace(context: PdfContext, height: number): void {
  if (context.y - height < 55) addPage(context);
}

function drawLines(
  context: PdfContext,
  lines: string[],
  options: {
    x?: number;
    width?: number;
    size?: number;
    lineHeight?: number;
    font?: PDFFont;
    color?: RGB;
    gapAfter?: number;
  } = {},
): void {
  const x = options.x ?? MARGIN;
  const width = options.width ?? CONTENT_WIDTH;
  const size = options.size ?? 9.5;
  const lineHeight = options.lineHeight ?? size * 1.45;
  const font = options.font ?? context.regular;
  const color = options.color ?? INK;
  for (const paragraph of lines) {
    const wrapped = wrap(paragraph, font, size, width);
    for (const line of wrapped) {
      ensureSpace(context, lineHeight);
      context.page.drawText(line, { x, y: context.y, size, font, color });
      context.y -= lineHeight;
    }
  }
  context.y -= options.gapAfter ?? 0;
}

function sectionTitle(
  context: PdfContext,
  title: string,
  subtitle?: string,
): void {
  ensureSpace(context, subtitle ? 50 : 34);
  context.y -= 7;
  context.page.drawRectangle({
    x: MARGIN,
    y: context.y - 5,
    width: 4,
    height: 17,
    color: TEAL,
  });
  context.page.drawText(title, {
    x: MARGIN + 12,
    y: context.y,
    font: context.bold,
    size: 13,
    color: TEAL_DARK,
  });
  context.y -= 18;
  if (subtitle) {
    drawLines(context, [subtitle], { size: 8.2, color: MUTED, gapAfter: 4 });
  }
}

function itemHeight(
  title: string,
  details: string[],
  context: PdfContext,
  width = CONTENT_WIDTH - 28,
): number {
  const titleLines = wrap(title, context.bold, 10.2, width).length;
  const detailLines = details.reduce(
    (count, detail) => count + wrap(detail, context.regular, 8.7, width).length,
    0,
  );
  return 18 + titleLines * 14 + detailLines * 12.5;
}

function itemCard(
  context: PdfContext,
  title: string,
  details: string[],
  colors: { fill?: RGB; border?: RGB; title?: RGB } = {},
): void {
  const filtered = details.map(clean).filter(Boolean);
  const height = Math.max(44, itemHeight(title, filtered, context));
  ensureSpace(context, height + 8);
  const top = context.y;
  context.page.drawRectangle({
    x: MARGIN,
    y: top - height,
    width: CONTENT_WIDTH,
    height,
    color: colors.fill ?? LIGHT,
    borderColor: colors.border ?? BORDER,
    borderWidth: 0.7,
  });
  context.y = top - 17;
  drawLines(context, [title], {
    x: MARGIN + 14,
    width: CONTENT_WIDTH - 28,
    size: 10.2,
    lineHeight: 14,
    font: context.bold,
    color: colors.title ?? INK,
  });
  for (const detail of filtered) {
    drawLines(context, [detail], {
      x: MARGIN + 14,
      width: CONTENT_WIDTH - 28,
      size: 8.7,
      lineHeight: 12.5,
      color: MUTED,
    });
  }
  context.y = top - height - 7;
}

function emptyCard(context: PdfContext, label: string): void {
  itemCard(context, 'No information recorded / Chưa ghi nhận', [label]);
}

function referenceLabel(
  low: number | null,
  high: number | null,
  referenceText: string,
  unit: string,
): string {
  const range =
    low === null && high === null
      ? ''
      : low === null
        ? `≤ ${high}`
        : high === null
          ? `≥ ${low}`
          : `${low}–${high}`;
  return [
    range ? `Source reference: ${range} ${unit}`.trim() : '',
    referenceText,
  ]
    .filter(Boolean)
    .join(' · ');
}

function drawPatientHeader(
  context: PdfContext,
  snapshot: IpsSnapshot,
  generatedAt: string,
): void {
  const patientName =
    snapshot.patient.display_name.trim() || 'Name unavailable / Chưa có tên';
  const medicalRecordNumber =
    snapshot.patient.medical_record_number.trim() ||
    'Unavailable / Chưa ghi nhận';
  context.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 178,
    width: PAGE_WIDTH,
    height: 178,
    color: TEAL_DARK,
  });
  context.page.drawText('MediPass', {
    x: MARGIN,
    y: PAGE_HEIGHT - 39,
    font: context.bold,
    size: 13,
    color: rgb(0.75, 0.93, 0.89),
  });
  context.page.drawText('INTERNATIONAL PATIENT SUMMARY', {
    x: MARGIN,
    y: PAGE_HEIGHT - 74,
    font: context.bold,
    size: 20,
    color: rgb(1, 1, 1),
  });
  context.page.drawText(
    'Tóm tắt Sức khỏe Quốc tế · IPS-aligned preliminary export',
    {
      x: MARGIN,
      y: PAGE_HEIGHT - 94,
      font: context.regular,
      size: 9.5,
      color: rgb(0.77, 0.9, 0.88),
    },
  );
  context.page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - 137,
    width: 238,
    height: 27,
    color: rgb(0.98, 0.78, 0.34),
  });
  context.page.drawText('PRELIMINARY · NOT CLINICIAN-ATTESTED', {
    x: MARGIN + 10,
    y: PAGE_HEIGHT - 128,
    font: context.bold,
    size: 8.3,
    color: rgb(0.28, 0.2, 0.04),
  });
  context.page.drawText(`Generated / Tạo lúc: ${humanDate(generatedAt)}`, {
    x: MARGIN,
    y: PAGE_HEIGHT - 159,
    font: context.regular,
    size: 8,
    color: rgb(0.72, 0.86, 0.84),
  });
  context.y = PAGE_HEIGHT - 205;
  context.page.drawText(patientName, {
    x: MARGIN,
    y: context.y,
    font: context.bold,
    size: 19,
    color: INK,
  });
  context.y -= 19;
  drawLines(
    context,
    [
      `Medical record / Mã hồ sơ: ${medicalRecordNumber}`,
      `Date of birth / Ngày sinh: ${humanDate(snapshot.patient.birth_date)}   ·   Sex: ${snapshot.patient.sex}   ·   Blood type: ${snapshot.patient.blood_type || 'not recorded'}`,
    ],
    { size: 9, color: MUTED, lineHeight: 13 },
  );
  if (snapshot.patient.emergency_contact) {
    drawLines(
      context,
      [
        `Emergency contact / Liên hệ khẩn cấp: ${snapshot.patient.emergency_contact}`,
      ],
      {
        size: 8.7,
        color: MUTED,
        lineHeight: 12.5,
      },
    );
  }
  context.y -= 7;
}

function addPageFooters(context: PdfContext): void {
  const pages = context.document.getPages();
  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN, y: 43 },
      end: { x: PAGE_WIDTH - MARGIN, y: 43 },
      thickness: 0.6,
      color: BORDER,
    });
    page.drawText(
      'Sensitive personal health information · Share only with intended care teams',
      {
        x: MARGIN,
        y: 27,
        font: context.regular,
        size: 7,
        color: MUTED,
      },
    );
    const number = `${index + 1} / ${pages.length}`;
    page.drawText(number, {
      x: PAGE_WIDTH - MARGIN - context.bold.widthOfTextAtSize(number, 7),
      y: 27,
      font: context.bold,
      size: 7,
      color: MUTED,
    });
  });
}

export async function buildIpsPdf(
  snapshot: IpsSnapshot,
  bundle: FhirBundle,
  regularFontBytes: Uint8Array,
  boldFontBytes: Uint8Array,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const regular = await document.embedFont(regularFontBytes, { subset: false });
  const bold = await document.embedFont(boldFontBytes, { subset: false });
  const firstPage = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const context: PdfContext = {
    document,
    regular,
    bold,
    page: firstPage,
    y: 0,
  };
  const generatedAt = bundle.timestamp;
  const patientName = snapshot.patient.display_name.trim() || 'Name unavailable';
  document.setTitle(
    `International Patient Summary — ${patientName}`,
  );
  document.setAuthor('MediPass Demo');
  document.setSubject(
    'Preliminary HL7 FHIR International Patient Summary export',
  );
  document.setKeywords([
    'HL7 FHIR',
    'International Patient Summary',
    'IPS',
    'MediPass',
  ]);
  document.setProducer('MediPass Demo using pdf-lib');
  document.setCreator('MediPass Demo');
  document.setCreationDate(new Date(generatedAt));
  document.setModificationDate(new Date(generatedAt));

  drawPatientHeader(context, snapshot, generatedAt);

  sectionTitle(
    context,
    'Allergies & intolerances / Dị ứng',
    'Entries in the current allergy list are exported as active and unconfirmed; verify clinically.',
  );
  if (snapshot.allergies.length) {
    for (const allergy of snapshot.allergies) {
      itemCard(
        context,
        allergy.substance,
        [
          `Reaction / Phản ứng: ${allergy.reaction || 'not recorded'}`,
          `Severity / Mức độ: ${allergy.severity}`,
          allergy.note,
        ],
        { fill: ROSE, border: rgb(0.91, 0.76, 0.68), title: ROSE_INK },
      );
    }
  } else
    emptyCard(
      context,
      'The source record contains no allergy entries; this does not prove no allergy exists.',
    );

  sectionTitle(context, 'Active problems / Bệnh đang theo dõi');
  if (snapshot.conditions.length) {
    for (const condition of snapshot.conditions) {
      itemCard(context, condition.name, [
        condition.clinical_term
          ? `Clinical term: ${condition.clinical_term}`
          : '',
        `Status: ${condition.status}${condition.since ? ` · Since: ${condition.since}` : ''}`,
        condition.note,
      ]);
    }
  } else
    emptyCard(
      context,
      'The source record contains no problem entries; this does not prove no problem exists.',
    );

  sectionTitle(
    context,
    'Medication summary / Thuốc đang dùng',
    'INN and WHO ATC appear only for exact curated catalog matches. ATC is not a therapeutic-substitution instruction.',
  );
  if (snapshot.medications.length) {
    for (const medication of snapshot.medications) {
      itemCard(
        context,
        medication.name,
        [
          medication.inn
            ? `INN: ${medication.inn}   ·   WHO ATC: ${medication.atc}`
            : 'INN / ATC: not mapped — original medication name preserved',
          [
            medication.dose,
            medication.route,
            medication.frequency,
            medication.duration,
          ]
            .filter(Boolean)
            .join(' · '),
          medication.instructions,
          `Recorded: ${humanDate(medication.recordedDate)} · Status: active`,
        ],
        medication.inn
          ? { fill: LIGHT_TEAL }
          : { fill: AMBER, border: rgb(0.89, 0.78, 0.49), title: AMBER_INK },
      );
    }
  } else
    emptyCard(
      context,
      'The source record contains no active medication entries; this does not prove no medication is being taken.',
    );
  itemCard(
    context,
    'Medication safety / An toàn thuốc',
    [
      'Do not start, stop, replace, or change a dose from this summary. Product strength, formulation, device, excipients, legal status, and availability vary by country.',
      'Ask a pharmacist or prescribing clinician to verify the original package, prescription, allergies, interactions, kidney/liver function, and local product before purchase or use.',
    ],
    { fill: AMBER, border: rgb(0.89, 0.78, 0.49), title: AMBER_INK },
  );

  sectionTitle(
    context,
    'Latest diagnostic results / Kết quả gần nhất',
    'One latest saved result per exact test name. Reference ranges are copied from the source record.',
  );
  if (snapshot.results.length) {
    for (const result of snapshot.results) {
      itemCard(
        context,
        `${result.name}: ${result.value} ${result.unit}`.trim(),
        [
          result.plain_name,
          referenceLabel(
            result.reference_low,
            result.reference_high,
            result.reference_text,
            result.unit,
          ),
          result.clinician_note
            ? `Clinician note: ${result.clinician_note}`
            : '',
          `Encounter record date: ${humanDate(result.recordedDate)} · FHIR result status: unknown · Collection/result time: unavailable`,
        ],
      );
    }
  } else
    emptyCard(
      context,
      'No laboratory results are recorded in the source record.',
    );

  sectionTitle(context, 'Latest vital signs / Dấu hiệu sinh tồn gần nhất');
  if (snapshot.vitals.length) {
    for (const vital of snapshot.vitals) {
      itemCard(context, `${vital.label}: ${vital.value} ${vital.unit}`, [
        `Recorded: ${humanDate(vital.recordedDate)}`,
      ]);
    }
  } else
    emptyCard(
      context,
      'No vital-sign values are recorded in the source record.',
    );

  sectionTitle(context, 'Relevant procedures / Thủ thuật liên quan');
  if (snapshot.procedures.length) {
    for (const procedure of snapshot.procedures) {
      itemCard(context, procedure.name, [
        procedure.result ? `Outcome: ${procedure.result}` : '',
        procedure.explanation,
        `Encounter record date / Ngày hồ sơ lần khám: ${humanDate(procedure.performedDate)} · FHIR procedure status: unknown`,
      ]);
    }
  } else
    emptyCard(
      context,
      'No procedure entries are recorded in the source record.',
    );

  sectionTitle(context, 'Latest recorded plan / Kế hoạch được ghi gần nhất');
  if (snapshot.plan) {
    itemCard(context, 'Most recently recorded plan', [
      snapshot.plan.treatmentPlan,
      snapshot.plan.followUp,
      snapshot.plan.followUpDate
        ? `Follow-up date / Ngày tái khám: ${humanDate(snapshot.plan.followUpDate)}`
        : '',
      `Plan recorded: ${humanDate(snapshot.plan.recordedDate)} · FHIR plan status: unknown`,
    ]);
  } else
    emptyCard(context, 'No care-plan entry is recorded in the source record.');

  sectionTitle(
    context,
    'Document status, scope & provenance / Phạm vi và nguồn',
  );
  itemCard(context, 'Important limitations', [
    'This is a system-generated, preliminary summary of selected portal fields—not the complete source chart, not a diagnosis, not a prescription, and not proof that no other information exists.',
    'The FHIR Bundle declares IPS 2.0.1 profile intent on FHIR R4. It is generated against the IPS profile but is not digitally signed or attested by a clinician.',
    `Source storage shown at export: ${snapshot.sourceLabel}`,
    `Latest included encounter: ${humanDate(snapshot.latestEncounterDate)}`,
    `FHIR document identifier: ${bundle.identifier.value}`,
  ]);
  itemCard(
    context,
    'Machine-readable attachment',
    [
      'The exact HL7 FHIR document Bundle used for this PDF is embedded as medipass-ips.fhir.json (media type application/fhir+json). A separate JSON download is also available from MediPass.',
      'Some PDF viewers hide file attachments. Clinical systems should ingest and validate the JSON Bundle, not extract clinical facts from the visual PDF.',
    ],
    { fill: LIGHT_TEAL },
  );
  itemCard(
    context,
    'Privacy / Quyền riêng tư',
    [
      'This document contains identifiable health information. Store and transmit it securely, verify the intended recipient, and delete unnecessary copies. No data is sent to a third party by the export action itself.',
    ],
    { fill: ROSE, border: rgb(0.91, 0.76, 0.68), title: ROSE_INK },
  );
  itemCard(
    context,
    'Clinical check / Xác nhận chuyên môn',
    [
      'Before relying on this summary—especially for emergency care, travel, medication purchase, or medication conversion—ask a qualified clinician or pharmacist to reconcile it with the patient, original labels, prescriptions, and current clinical status.',
    ],
    { fill: AMBER, border: rgb(0.89, 0.78, 0.49), title: AMBER_INK },
  );

  const bundleBytes = new TextEncoder().encode(JSON.stringify(bundle, null, 2));
  await document.attach(bundleBytes, 'medipass-ips.fhir.json', {
    mimeType: 'application/fhir+json',
    description: 'HL7 FHIR R4 International Patient Summary document Bundle',
    creationDate: new Date(generatedAt),
    modificationDate: new Date(generatedAt),
  });

  addPageFooters(context);
  return document.save({ useObjectStreams: false });
}
