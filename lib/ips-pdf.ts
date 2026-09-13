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
const CONTENT_BOTTOM = 52;

const PAPER = rgb(0.965, 0.978, 0.982);
const WHITE = rgb(1, 1, 1);
const NAVY = rgb(0.075, 0.216, 0.29);
const NAVY_DARK = rgb(0.055, 0.18, 0.245);
const INK = rgb(0.075, 0.19, 0.25);
const MUTED = rgb(0.33, 0.44, 0.5);
const LABEL = rgb(0.29, 0.41, 0.47);
const TEAL = rgb(0.025, 0.53, 0.48);
const TEAL_DARK = rgb(0.02, 0.38, 0.35);
const TEAL_LIGHT = rgb(0.91, 0.965, 0.95);
const BLUE_LIGHT = rgb(0.92, 0.96, 0.975);
const BORDER = rgb(0.76, 0.84, 0.87);
const CORAL = rgb(0.73, 0.22, 0.15);
const CORAL_LIGHT = rgb(1, 0.94, 0.91);
const CORAL_BORDER = rgb(0.94, 0.61, 0.52);
const AMBER = rgb(0.94, 0.64, 0.08);
const AMBER_LIGHT = rgb(1, 0.965, 0.83);
const AMBER_BORDER = rgb(0.93, 0.67, 0.16);
const GREEN = rgb(0.13, 0.49, 0.35);

type PdfContext = {
  document: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
  medicalRecordNumber: string;
};

type CardStyle = {
  fill: RGB;
  border: RGB;
  accent: RGB;
};

type EssentialDetails = {
  allergies: boolean;
  conditions: boolean;
  medications: boolean;
};

const essentialStyles: Record<
  'allergy' | 'condition' | 'medication',
  CardStyle
> = {
  allergy: { fill: CORAL_LIGHT, border: CORAL_BORDER, accent: CORAL },
  condition: { fill: BLUE_LIGHT, border: BORDER, accent: NAVY },
  medication: {
    fill: TEAL_LIGHT,
    border: rgb(0.62, 0.83, 0.78),
    accent: TEAL_DARK,
  },
};

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function humanDate(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[3] + '/' + match[2] + '/' + match[1] : value;
}

function shortDate(value: string | null | undefined): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '--';
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  return match[3] + ' ' + months[Number(match[2]) - 1];
}

function sexLabel(value: string): string {
  const normalized = clean(value).toLowerCase();
  if (normalized === 'female' || normalized === 'nữ' || normalized === 'nu')
    return 'Female';
  if (normalized === 'male' || normalized === 'nam') return 'Male / Nam';
  return value || 'Not recorded';
}

function patientInitials(value: string): string {
  const parts = clean(value).split(' ').filter(Boolean);
  if (!parts.length) return '--';
  const last = parts.length > 1 ? parts.at(-1)?.[0] || '' : '';
  return (parts[0][0] + last).toUpperCase();
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
    const candidate = line ? line + ' ' + word : word;
    if (line && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function ellipsize(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string {
  let value = clean(text);
  while (value && font.widthOfTextAtSize(value + '...', size) > width) {
    value = value.slice(0, -1).trimEnd();
  }
  return value + '...';
}

function limitedLines(
  paragraphs: string[],
  font: PDFFont,
  size: number,
  width: number,
  limit: number,
): { lines: string[]; truncated: boolean } {
  const all = paragraphs
    .map(clean)
    .filter(Boolean)
    .flatMap((item) => wrap(item, font, size, width));
  if (all.length <= limit) return { lines: all, truncated: false };
  const lines = all.slice(0, limit);
  lines[limit - 1] = ellipsize(lines[limit - 1], font, size, width);
  return { lines, truncated: true };
}

function fillRoundedRectangle(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: RGB,
): void {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  page.drawRectangle({
    x: x + safeRadius,
    y,
    width: width - safeRadius * 2,
    height,
    color,
  });
  page.drawRectangle({
    x,
    y: y + safeRadius,
    width,
    height: height - safeRadius * 2,
    color,
  });
  for (const point of [
    [x + safeRadius, y + safeRadius],
    [x + width - safeRadius, y + safeRadius],
    [x + safeRadius, y + height - safeRadius],
    [x + width - safeRadius, y + height - safeRadius],
  ]) {
    page.drawCircle({
      x: point[0],
      y: point[1],
      size: safeRadius,
      color,
    });
  }
}

function roundedRectangle(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: RGB,
  border?: RGB,
): void {
  if (border) {
    fillRoundedRectangle(page, x, y, width, height, radius, border);
    fillRoundedRectangle(
      page,
      x + 0.8,
      y + 0.8,
      width - 1.6,
      height - 1.6,
      Math.max(0, radius - 0.8),
      fill,
    );
  } else {
    fillRoundedRectangle(page, x, y, width, height, radius, fill);
  }
}

function drawLines(
  page: PDFPage,
  lines: string[],
  options: {
    x: number;
    y: number;
    font: PDFFont;
    size: number;
    color: RGB;
    lineHeight: number;
  },
): number {
  let y = options.y;
  for (const line of lines) {
    page.drawText(line, {
      x: options.x,
      y,
      font: options.font,
      size: options.size,
      color: options.color,
    });
    y -= options.lineHeight;
  }
  return y;
}

function rightAlignedX(
  font: PDFFont,
  text: string,
  size: number,
  right: number,
): number {
  return right - font.widthOfTextAtSize(text, size);
}

function centeredX(
  font: PDFFont,
  text: string,
  size: number,
  x: number,
  width: number,
): number {
  return x + Math.max(0, (width - font.widthOfTextAtSize(text, size)) / 2);
}

function drawBrandMark(
  context: PdfContext,
  x: number,
  y: number,
  compact = false,
): void {
  const radius = compact ? 8 : 10;
  const size = compact ? 7 : 8.5;
  context.page.drawCircle({ x, y, size: radius, color: TEAL });
  context.page.drawText('M', {
    x: centeredX(context.bold, 'M', size, x - radius, radius * 2),
    y: y - size * 0.36,
    font: context.bold,
    size,
    color: WHITE,
  });
}

function preparePage(page: PDFPage): void {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: PAPER,
  });
}

function addContinuationPage(context: PdfContext): void {
  context.page = context.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  preparePage(context.page);
  context.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 68,
    width: PAGE_WIDTH,
    height: 68,
    color: NAVY,
  });
  drawBrandMark(context, MARGIN + 8, PAGE_HEIGHT - 14, true);
  context.page.drawText('MediPass  |  INTERNATIONAL PATIENT SUMMARY', {
    x: MARGIN + 25,
    y: PAGE_HEIGHT - 18,
    font: context.bold,
    size: 10,
    color: WHITE,
  });
  context.page.drawText('Clinical details, provenance and safe-use notes', {
    x: MARGIN + 25,
    y: PAGE_HEIGHT - 35,
    font: context.regular,
    size: 7.2,
    color: rgb(0.77, 0.88, 0.91),
  });
  context.page.drawText(context.medicalRecordNumber, {
    x: rightAlignedX(
      context.bold,
      context.medicalRecordNumber,
      7.5,
      PAGE_WIDTH - MARGIN,
    ),
    y: PAGE_HEIGHT - 17,
    font: context.bold,
    size: 7.5,
    color: rgb(0.78, 0.89, 0.91),
  });
  context.y = PAGE_HEIGHT - 90;
}

function ensureSpace(context: PdfContext, height: number): void {
  if (context.y - height < CONTENT_BOTTOM) addContinuationPage(context);
}

function drawPill(
  context: PdfContext,
  label: string,
  x: number,
  y: number,
  fill: RGB,
  color: RGB,
): number {
  const size = 7.2;
  const height = 20;
  const width = context.bold.widthOfTextAtSize(label, size) + 20;
  roundedRectangle(context.page, x, y, width, height, height / 2, fill);
  context.page.drawText(label, {
    x: centeredX(context.bold, label, size, x, width),
    y: y + 6.3,
    font: context.bold,
    size,
    color,
  });
  return width;
}

function drawHero(context: PdfContext, generatedAt: string): void {
  context.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 151,
    width: PAGE_WIDTH,
    height: 151,
    color: NAVY,
  });
  drawBrandMark(context, MARGIN + 10, PAGE_HEIGHT - 34);
  context.page.drawText('MediPass', {
    x: MARGIN + 27,
    y: PAGE_HEIGHT - 39,
    font: context.bold,
    size: 11,
    color: WHITE,
  });
  context.page.drawText('INTERNATIONAL PATIENT SUMMARY', {
    x: MARGIN,
    y: PAGE_HEIGHT - 79,
    font: context.bold,
    size: 20,
    color: WHITE,
  });
  context.page.drawText(
    'International Patient Summary  |  Human-readable clinical summary',
    {
      x: MARGIN,
      y: PAGE_HEIGHT - 99,
      font: context.regular,
      size: 8.8,
      color: rgb(0.76, 0.88, 0.9),
    },
  );
  let x = MARGIN;
  x +=
    drawPill(context, 'PRELIMINARY', x, PAGE_HEIGHT - 132, AMBER, NAVY_DARK) +
    8;
  x +=
    drawPill(
      context,
      'NOT CLINICIAN-ATTESTED',
      x,
      PAGE_HEIGHT - 132,
      rgb(0.23, 0.38, 0.45),
      WHITE,
    ) + 8;
  x += drawPill(context, 'FHIR R4', x, PAGE_HEIGHT - 132, TEAL, WHITE) + 8;
  drawPill(
    context,
    'IPS 2.0.1',
    x,
    PAGE_HEIGHT - 132,
    rgb(0.23, 0.38, 0.45),
    WHITE,
  );
  const generated = 'Generated: ' + humanDate(generatedAt);
  context.page.drawText(generated, {
    x: rightAlignedX(context.regular, generated, 7.3, PAGE_WIDTH - MARGIN),
    y: PAGE_HEIGHT - 130,
    font: context.regular,
    size: 7.3,
    color: rgb(0.79, 0.88, 0.9),
  });
}

function drawPatientCard(context: PdfContext, snapshot: IpsSnapshot): void {
  const height = 99;
  const top = PAGE_HEIGHT - 166;
  const bottom = top - height;
  roundedRectangle(
    context.page,
    MARGIN,
    bottom,
    CONTENT_WIDTH,
    height,
    9,
    WHITE,
    BORDER,
  );
  const patientName =
    clean(snapshot.patient.display_name) || 'Name unavailable';
  const mark = patientInitials(patientName);
  roundedRectangle(context.page, MARGIN + 14, top - 30, 30, 30, 6, TEAL_DARK);
  context.page.drawText(mark, {
    x: centeredX(context.bold, mark, 10, MARGIN + 14, 30),
    y: top - 19,
    font: context.bold,
    size: 10,
    color: WHITE,
  });
  const name = limitedLines(
    [patientName],
    context.bold,
    17,
    CONTENT_WIDTH - 72,
    1,
  ).lines[0];
  context.page.drawText(name, {
    x: MARGIN + 57,
    y: top - 18,
    font: context.bold,
    size: 17,
    color: INK,
  });
  context.page.drawText('PATIENT', {
    x: MARGIN + 57,
    y: top - 38,
    font: context.bold,
    size: 6.8,
    color: TEAL_DARK,
  });

  const emergency = clean(
    snapshot.patient.emergency_contact || 'Not recorded',
  );
  const fields = [
    {
      label: 'MEDICAL RECORD NUMBER',
      value: context.medicalRecordNumber,
      x: MARGIN + 14,
      width: 98,
    },
    {
      label: 'DATE OF BIRTH',
      value: humanDate(snapshot.patient.birth_date),
      x: MARGIN + 118,
      width: 98,
    },
    {
      label: 'SEX',
      value: sexLabel(snapshot.patient.sex),
      x: MARGIN + 222,
      width: 84,
    },
    {
      label: 'BLOOD TYPE',
      value: snapshot.patient.blood_type || 'Not recorded',
      x: MARGIN + 311,
      width: 67,
    },
    {
      label: 'EMERGENCY CONTACT',
      value: emergency,
      x: MARGIN + 392,
      width: 102,
    },
  ];
  context.page.drawLine({
    start: { x: MARGIN + 383, y: bottom + 14 },
    end: { x: MARGIN + 383, y: bottom + 53 },
    thickness: 0.7,
    color: BORDER,
  });
  for (const [index, field] of fields.entries()) {
    context.page.drawText(field.label, {
      x: field.x,
      y: bottom + 43,
      font: context.bold,
      size: 5.5,
      color: LABEL,
    });
    const isEmergency = index === fields.length - 1;
    const size = isEmergency ? 7.1 : 8.6;
    const lines = limitedLines(
      [field.value],
      isEmergency ? context.regular : context.bold,
      size,
      field.width,
      isEmergency ? 2 : 1,
    ).lines;
    drawLines(context.page, lines, {
      x: field.x,
      y: bottom + 25,
      font: isEmergency ? context.regular : context.bold,
      size,
      color: INK,
      lineHeight: 11,
    });
  }
  context.y = bottom - 18;
}

function drawSectionHeading(
  context: PdfContext,
  number: number,
  title: string,
  vietnamese: string,
): void {
  ensureSpace(context, 33);
  roundedRectangle(context.page, MARGIN, context.y - 22, 22, 22, 4, TEAL_DARK);
  const index = String(number);
  context.page.drawText(index, {
    x: centeredX(context.bold, index, 9, MARGIN, 22),
    y: context.y - 15.2,
    font: context.bold,
    size: 9,
    color: WHITE,
  });
  context.page.drawText(title, {
    x: MARGIN + 31,
    y: context.y - 16,
    font: context.bold,
    size: 12.5,
    color: INK,
  });
  const titleWidth = context.bold.widthOfTextAtSize(title, 12.5);
  context.page.drawText(' | ' + vietnamese, {
    x: MARGIN + 31 + titleWidth,
    y: context.y - 16,
    font: context.bold,
    size: 12.5,
    color: MUTED,
  });
  context.y -= 32;
}

function essentialPreview(
  context: PdfContext,
  title: string,
  details: string[],
  width: number,
  forceDetail: boolean,
): { titleLines: string[]; detailLines: string[]; needsDetail: boolean } {
  const allTitleLines = wrap(title, context.bold, 10, width);
  const titleLines = allTitleLines.slice(0, 2);
  if (allTitleLines.length > 2)
    titleLines[1] = ellipsize(titleLines[1], context.bold, 10, width);
  const initialDetails = limitedLines(details, context.regular, 7.6, width, 6);
  const needsDetail = forceDetail || allTitleLines.length > 2;
  const detailsPreview = needsDetail
    ? limitedLines(details, context.regular, 7.6, width, 4)
    : initialDetails;
  return {
    titleLines,
    detailLines: detailsPreview.lines,
    needsDetail,
  };
}

function drawEssentialCard(
  context: PdfContext,
  options: {
    x: number;
    width: number;
    height: number;
    category: string;
    icon: string;
    title: string;
    details: string[];
    style: CardStyle;
    forceDetail: boolean;
  },
): boolean {
  const bottom = context.y - options.height;
  roundedRectangle(
    context.page,
    options.x,
    bottom,
    options.width,
    options.height,
    8,
    options.style.fill,
    options.style.border,
  );
  context.page.drawCircle({
    x: options.x + 18,
    y: context.y - 18,
    size: 7,
    color: options.style.accent,
  });
  const iconSize = options.icon.length > 1 ? 5.4 : 7;
  context.page.drawText(options.icon, {
    x: centeredX(context.bold, options.icon, iconSize, options.x + 11, 14),
    y: context.y - 20.6,
    font: context.bold,
    size: iconSize,
    color: WHITE,
  });
  context.page.drawText(options.category, {
    x: options.x + 32,
    y: context.y - 20.5,
    font: context.bold,
    size: 6.7,
    color: LABEL,
  });
  const preview = essentialPreview(
    context,
    options.title,
    options.details,
    options.width - 28,
    options.forceDetail,
  );
  let y = drawLines(context.page, preview.titleLines, {
    x: options.x + 14,
    y: context.y - 48,
    font: context.bold,
    size: 10,
    color: INK,
    lineHeight: 12.5,
  });
  y -= 3;
  drawLines(context.page, preview.detailLines, {
    x: options.x + 14,
    y,
    font: context.regular,
    size: 7.6,
    color: MUTED,
    lineHeight: 10.2,
  });
  if (preview.needsDetail) {
    context.page.drawText('Complete list in clinical details', {
      x: options.x + 14,
      y: bottom + 10,
      font: context.bold,
      size: 5.8,
      color: options.style.accent,
    });
  }
  return preview.needsDetail;
}

function drawClinicalEssentials(
  context: PdfContext,
  snapshot: IpsSnapshot,
): EssentialDetails {
  drawSectionHeading(context, 1, 'Clinical essentials', 'Key information');
  const gap = 10;
  const width = (CONTENT_WIDTH - gap * 2) / 3;
  const height = 123;
  const allergy = snapshot.allergies[0];
  const condition = snapshot.conditions[0];
  const medication = snapshot.medications[0];

  const allergies = drawEssentialCard(context, {
    x: MARGIN,
    width,
    height,
    category: 'ALLERGY',
    icon: '!',
    title: allergy?.substance || 'No information recorded',
    details: allergy
      ? [
          'Reaction: ' + (allergy.reaction || 'not recorded'),
          'Severity: ' + allergy.severity,
          'Status: Active, unconfirmed',
          allergy.note,
        ]
      : ['Source list has no recorded allergy entries.'],
    style: essentialStyles.allergy,
    forceDetail: snapshot.allergies.length > 1,
  });
  const conditions = drawEssentialCard(context, {
    x: MARGIN + width + gap,
    width,
    height,
    category: 'ACTIVE PROBLEM',
    icon: 'P',
    title: condition?.name || 'No information recorded',
    details: condition
      ? [
          condition.clinical_term
            ? 'Clinical term: ' + condition.clinical_term
            : '',
          'Status: ' + condition.status,
          condition.since ? 'Since: ' + condition.since : '',
          condition.note,
        ]
      : ['Source list has no recorded active problem entries.'],
    style: essentialStyles.condition,
    forceDetail: snapshot.conditions.length > 1,
  });
  const medications = drawEssentialCard(context, {
    x: MARGIN + (width + gap) * 2,
    width,
    height,
    category: 'MEDICATION',
    icon: 'Rx',
    title: medication?.name || 'No information recorded',
    details: medication
      ? [
          medication.inn ? 'INN: ' + medication.inn : 'INN / ATC: not mapped',
          medication.atc ? 'WHO ATC: ' + medication.atc : '',
          [medication.dose, medication.route].filter(Boolean).join(' | '),
          medication.frequency,
          medication.instructions,
        ]
      : ['Source list has no recorded active medication entries.'],
    style: essentialStyles.medication,
    forceDetail: snapshot.medications.length > 1,
  });
  context.y -= height + 14;
  return { allergies, conditions, medications };
}

function drawMedicationSafety(context: PdfContext): void {
  const height = 73;
  const bottom = context.y - height;
  roundedRectangle(
    context.page,
    MARGIN,
    bottom,
    CONTENT_WIDTH,
    height,
    8,
    AMBER_LIGHT,
    AMBER_BORDER,
  );
  roundedRectangle(context.page, MARGIN + 14, context.y - 29, 29, 29, 5, AMBER);
  context.page.drawText('!', {
    x: centeredX(context.bold, '!', 11, MARGIN + 14, 29),
    y: context.y - 20,
    font: context.bold,
    size: 11,
    color: NAVY,
  });
  context.page.drawText('Medication safety', {
    x: MARGIN + 56,
    y: context.y - 22,
    font: context.bold,
    size: 9.7,
    color: INK,
  });
  const safety =
    'Do not start, stop, replace, or change a dose from this summary. Product strength, formulation, device, excipients, legal status, and availability vary by country. Ask a pharmacist or prescribing clinician to verify the original package, prescription, allergies, interactions, kidney/liver function, and local product before purchase or use.';
  drawLines(
    context.page,
    wrap(safety, context.regular, 6.9, CONTENT_WIDTH - 86).slice(0, 4),
    {
      x: MARGIN + 56,
      y: context.y - 43,
      font: context.regular,
      size: 6.9,
      color: MUTED,
      lineHeight: 9.2,
    },
  );
  context.y = bottom - 19;
}

function drawVitals(context: PdfContext, snapshot: IpsSnapshot): void {
  drawSectionHeading(
    context,
    2,
    'Latest vital signs',
    'Latest vital signs',
  );
  const height = 75;
  const bottom = context.y - height;
  roundedRectangle(
    context.page,
    MARGIN,
    bottom,
    CONTENT_WIDTH,
    height,
    8,
    WHITE,
    BORDER,
  );
  const vitals = snapshot.vitals.slice(0, 5);
  if (!vitals.length) {
    context.page.drawCircle({
      x: MARGIN + 27,
      y: bottom + height / 2,
      size: 13,
      color: NAVY,
    });
    context.page.drawText('-', {
      x: centeredX(context.bold, '-', 12, MARGIN + 14, 26),
      y: bottom + height / 2 - 4,
      font: context.bold,
      size: 12,
      color: WHITE,
    });
    context.page.drawText('No information recorded', {
      x: MARGIN + 54,
      y: bottom + 42,
      font: context.bold,
      size: 9.6,
      color: INK,
    });
    context.page.drawText(
      'No vital-sign values are recorded in the source record.',
      {
        x: MARGIN + 54,
        y: bottom + 25,
        font: context.regular,
        size: 7.4,
        color: MUTED,
      },
    );
  } else {
    const cellWidth = CONTENT_WIDTH / vitals.length;
    vitals.forEach((vital, index) => {
      const x = MARGIN + cellWidth * index;
      if (index) {
        context.page.drawLine({
          start: { x, y: bottom + 13 },
          end: { x, y: bottom + height - 13 },
          thickness: 0.65,
          color: BORDER,
        });
      }
      const label = vital.label.toUpperCase();
      const labelLines = limitedLines(
        [label],
        context.bold,
        5.8,
        cellWidth - 12,
        2,
      ).lines;
      for (const [lineIndex, line] of labelLines.entries()) {
        context.page.drawText(line, {
          x: centeredX(context.bold, line, 5.8, x, cellWidth),
          y: bottom + 58 - lineIndex * 7,
          font: context.bold,
          size: 5.8,
          color: LABEL,
        });
      }
      const value = clean(vital.value);
      context.page.drawText(value, {
        x: centeredX(context.bold, value, 15, x, cellWidth),
        y: bottom + 31,
        font: context.bold,
        size: 15,
        color: INK,
      });
      context.page.drawText(vital.unit, {
        x: centeredX(context.regular, vital.unit, 6.7, x, cellWidth),
        y: bottom + 17,
        font: context.regular,
        size: 6.7,
        color: MUTED,
      });
    });
    const recorded =
      'Recorded: ' + humanDate(vitals[0].recordedDate);
    context.page.drawText(recorded, {
      x: rightAlignedX(
        context.regular,
        recorded,
        6.1,
        MARGIN + CONTENT_WIDTH - 10,
      ),
      y: bottom + 5,
      font: context.regular,
      size: 6.1,
      color: MUTED,
    });
  }
  context.y = bottom - 18;
}

function drawCurrentPlan(context: PdfContext, snapshot: IpsSnapshot): void {
  drawSectionHeading(context, 3, 'Current plan', 'Follow-up and treatment');
  const height = 83;
  const bottom = context.y - height;
  roundedRectangle(
    context.page,
    MARGIN,
    bottom,
    CONTENT_WIDTH,
    height,
    8,
    WHITE,
    BORDER,
  );
  const plan = snapshot.plan;
  roundedRectangle(
    context.page,
    MARGIN + 14,
    bottom + 14,
    104,
    height - 28,
    6,
    plan ? GREEN : BLUE_LIGHT,
  );
  context.page.drawText(plan ? 'FOLLOW-UP' : 'NO PLAN RECORDED', {
    x: MARGIN + 25,
    y: bottom + 45,
    font: context.bold,
    size: 6.5,
    color: plan ? WHITE : NAVY,
  });
  const followUp = plan?.followUpDate
    ? humanDate(plan.followUpDate)
    : plan
      ? 'Not scheduled'
      : '--';
  context.page.drawText(followUp, {
    x: MARGIN + 25,
    y: bottom + 24,
    font: context.bold,
    size: plan?.followUpDate ? 13.2 : 8,
    color: plan ? WHITE : NAVY,
  });
  context.page.drawText(
    plan ? 'Most recently recorded plan' : 'Plan information unavailable',
    {
      x: MARGIN + 138,
      y: bottom + 57,
      font: context.bold,
      size: 9.6,
      color: INK,
    },
  );
  const paragraphs = plan
    ? [
        plan.treatmentPlan,
        plan.followUp,
        'Plan recorded: ' + humanDate(plan.recordedDate),
      ]
    : ['No care-plan entry is recorded in the source record.'];
  drawLines(
    context.page,
    limitedLines(paragraphs, context.regular, 7.3, CONTENT_WIDTH - 166, 4)
      .lines,
    {
      x: MARGIN + 138,
      y: bottom + 39,
      font: context.regular,
      size: 7.3,
      color: MUTED,
      lineHeight: 9.7,
    },
  );
  context.y = bottom - 10;
}

function detailCard(
  context: PdfContext,
  options: {
    label: string;
    marker: string;
    title: string;
    details: string[];
    style?: CardStyle;
  },
): void {
  const style = options.style || {
    fill: WHITE,
    border: BORDER,
    accent: TEAL_DARK,
  };
  const textWidth = CONTENT_WIDTH - 108;
  const allDetailLines = options.details
    .map(clean)
    .filter(Boolean)
    .flatMap((item) => wrap(item, context.regular, 7.6, textWidth));

  let remaining = allDetailLines;
  let part = 1;
  do {
    const partTitle =
      part === 1 ? options.title : options.title + ' (continued)';
    const partTitleLines = wrap(partTitle, context.bold, 10, textWidth);
    const fullHeight =
      29 + partTitleLines.length * 12.5 + remaining.length * 10;
    if (
      fullHeight <= PAGE_HEIGHT - 158 &&
      context.y - fullHeight < CONTENT_BOTTOM
    )
      addContinuationPage(context);
    const available = context.y - CONTENT_BOTTOM;
    const maximumLines = Math.max(
      1,
      Math.floor((available - 35 - partTitleLines.length * 12.5) / 10),
    );
    const chunk = remaining.slice(0, maximumLines);
    remaining = remaining.slice(maximumLines);
    const height = Math.max(
      66,
      29 + partTitleLines.length * 12.5 + chunk.length * 10,
    );
    ensureSpace(context, height);
    const bottom = context.y - height;
    roundedRectangle(
      context.page,
      MARGIN,
      bottom,
      CONTENT_WIDTH,
      height,
      8,
      style.fill,
      style.border,
    );
    roundedRectangle(
      context.page,
      MARGIN + 14,
      bottom + 16,
      52,
      height - 32,
      7,
      style.accent === CORAL ? CORAL_LIGHT : TEAL_LIGHT,
    );
    context.page.drawText(options.label, {
      x: MARGIN + 17,
      y: context.y - 32,
      font: context.bold,
      size: 6.2,
      color: style.accent,
    });
    context.page.drawText(options.marker, {
      x: MARGIN + 21,
      y: context.y - 50,
      font: context.bold,
      size: 9.5,
      color: style.accent,
    });
    let y = drawLines(context.page, partTitleLines, {
      x: MARGIN + 79,
      y: context.y - 25,
      font: context.bold,
      size: 10,
      color: INK,
      lineHeight: 12.5,
    });
    y -= 4;
    drawLines(context.page, chunk, {
      x: MARGIN + 79,
      y,
      font: context.regular,
      size: 7.6,
      color: MUTED,
      lineHeight: 10,
    });
    context.y = bottom - 13;
    part += 1;
  } while (remaining.length);
}

function drawCompleteLists(
  context: PdfContext,
  snapshot: IpsSnapshot,
  details: EssentialDetails,
): void {
  if (details.allergies) {
    for (const allergy of snapshot.allergies) {
      detailCard(context, {
        label: 'ALLERGY',
        marker: '!',
        title: allergy.substance,
        details: [
          'Reaction: ' + (allergy.reaction || 'not recorded'),
          'Severity: ' + allergy.severity,
          'Status: active, unconfirmed',
          allergy.note,
        ],
        style: essentialStyles.allergy,
      });
    }
  }
  if (details.conditions) {
    for (const condition of snapshot.conditions) {
      detailCard(context, {
        label: 'PROBLEM',
        marker: condition.since || 'ACTIVE',
        title: condition.name,
        details: [
          condition.clinical_term
            ? 'Clinical term: ' + condition.clinical_term
            : '',
          'Status: ' +
            condition.status +
            (condition.since ? ' | Since: ' + condition.since : ''),
          condition.note,
        ],
        style: essentialStyles.condition,
      });
    }
  }
  if (details.medications) {
    for (const medication of snapshot.medications) {
      detailCard(context, {
        label: 'MEDICATION',
        marker: 'Rx',
        title: medication.name,
        details: [
          medication.inn
            ? 'INN: ' + medication.inn + ' | WHO ATC: ' + medication.atc
            : 'INN / ATC: not mapped - original medication name preserved',
          [
            medication.dose,
            medication.route,
            medication.frequency,
            medication.duration,
          ]
            .filter(Boolean)
            .join(' | '),
          medication.instructions,
          'Recorded: ' +
            humanDate(medication.recordedDate) +
            ' | Status: active',
        ],
        style: essentialStyles.medication,
      });
    }
  }
}

function drawProcedures(context: PdfContext, snapshot: IpsSnapshot): void {
  if (!snapshot.procedures.length) {
    detailCard(context, {
      label: 'PROCEDURE',
      marker: '--',
      title: 'No information recorded',
      details: ['No procedure entries are recorded in the source record.'],
    });
    return;
  }
  for (const procedure of snapshot.procedures) {
    detailCard(context, {
      label: 'PROCEDURE',
      marker: shortDate(procedure.performedDate),
      title: procedure.name,
      details: [
        procedure.result ? 'Outcome: ' + procedure.result : '',
        procedure.explanation,
        'Performed: ' +
          humanDate(procedure.performedDate) +
          ' | FHIR status: unknown',
      ],
    });
  }
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
        ? '<= ' + high
        : high === null
          ? '>= ' + low
          : low + '-' + high;
  return [range ? 'Source reference: ' + range + ' ' + unit : '', referenceText]
    .filter(Boolean)
    .join(' | ');
}

function drawDiagnostics(context: PdfContext, snapshot: IpsSnapshot): void {
  if (snapshot.results.length) {
    for (const result of snapshot.results) {
      detailCard(context, {
        label: 'RESULT',
        marker: shortDate(result.recordedDate),
        title:
          result.name +
          ': ' +
          result.value +
          (result.unit ? ' ' + result.unit : ''),
        details: [
          result.plain_name,
          referenceLabel(
            result.reference_low,
            result.reference_high,
            result.reference_text,
            result.unit,
          ),
          result.clinician_note
            ? 'Clinician note: ' + result.clinician_note
            : '',
          'Encounter record date: ' +
            humanDate(result.recordedDate) +
            ' | FHIR result status: unknown | Collection/result time: unavailable',
        ],
        style: { fill: BLUE_LIGHT, border: BORDER, accent: NAVY },
      });
    }
    return;
  }

  ensureSpace(context, 66);
  const height = 66;
  const bottom = context.y - height;
  roundedRectangle(
    context.page,
    MARGIN,
    bottom,
    CONTENT_WIDTH,
    height,
    8,
    BLUE_LIGHT,
    BORDER,
  );
  context.page.drawCircle({
    x: MARGIN + 27,
    y: bottom + height / 2,
    size: 13,
    color: NAVY,
  });
  context.page.drawText('-', {
    x: centeredX(context.bold, '-', 12, MARGIN + 14, 26),
    y: bottom + height / 2 - 4,
    font: context.bold,
    size: 12,
    color: WHITE,
  });
  context.page.drawText(
    'Latest diagnostic results',
    {
      x: MARGIN + 52,
      y: bottom + 41,
      font: context.bold,
      size: 9.7,
      color: INK,
    },
  );
  const missingLabel = 'No information recorded.';
  context.page.drawText(missingLabel, {
    x: MARGIN + 52,
    y: bottom + 23,
    font: context.bold,
    size: 7.5,
    color: MUTED,
  });
  context.page.drawText(
    'No laboratory results are recorded in the source record.',
    {
      x: MARGIN + 52 + context.bold.widthOfTextAtSize(missingLabel, 7.5) + 4,
      y: bottom + 23,
      font: context.regular,
      size: 7.5,
      color: MUTED,
    },
  );
  context.y = bottom - 13;
}

function drawProvenance(
  context: PdfContext,
  snapshot: IpsSnapshot,
  bundle: FhirBundle,
): void {
  drawSectionHeading(
    context,
    5,
    'Document status, scope & provenance',
    'Scope and source',
  );
  const paragraphs = [
    'This is a system-generated, preliminary summary of selected portal fields - not the complete source chart, not a diagnosis, not a prescription, and not proof that no other information exists.',
    'The FHIR Bundle declares IPS 2.0.1 profile intent on FHIR R4. It has not been independently validated, digitally signed, or attested by a clinician.',
  ];
  const bodyLines = paragraphs.flatMap((item) =>
    wrap(item, context.regular, 7.7, CONTENT_WIDTH - 30),
  );
  const height = 86 + bodyLines.length * 10;
  ensureSpace(context, height);
  const bottom = context.y - height;
  roundedRectangle(
    context.page,
    MARGIN,
    bottom,
    CONTENT_WIDTH,
    height,
    8,
    WHITE,
    BORDER,
  );
  context.page.drawText('Important limitations', {
    x: MARGIN + 15,
    y: context.y - 25,
    font: context.bold,
    size: 9.7,
    color: INK,
  });
  const bodyBottom = drawLines(context.page, bodyLines, {
    x: MARGIN + 15,
    y: context.y - 46,
    font: context.regular,
    size: 7.7,
    color: MUTED,
    lineHeight: 10,
  });
  const ruleY = bodyBottom - 2;
  context.page.drawLine({
    start: { x: MARGIN + 15, y: ruleY },
    end: { x: MARGIN + CONTENT_WIDTH - 15, y: ruleY },
    thickness: 0.65,
    color: BORDER,
  });
  const metadata = [
    {
      label: 'SOURCE STORAGE',
      value: snapshot.sourceLabel,
      x: MARGIN + 15,
      width: 126,
    },
    {
      label: 'LATEST ENCOUNTER',
      value: humanDate(snapshot.latestEncounterDate),
      x: MARGIN + 154,
      width: 105,
    },
    {
      label: 'FHIR DOCUMENT ID',
      value: bundle.identifier.value,
      x: MARGIN + 278,
      width: CONTENT_WIDTH - 293,
    },
  ];
  for (const item of metadata) {
    context.page.drawText(item.label, {
      x: item.x,
      y: ruleY - 17,
      font: context.bold,
      size: 5.8,
      color: LABEL,
    });
    drawLines(
      context.page,
      limitedLines([item.value], context.bold, 6.7, item.width, 2).lines,
      {
        x: item.x,
        y: ruleY - 34,
        font: context.bold,
        size: 6.7,
        color: INK,
        lineHeight: 9,
      },
    );
  }
  context.y = bottom - 13;
}

function drawAttachmentNotice(context: PdfContext): void {
  const height = 89;
  ensureSpace(context, height);
  const bottom = context.y - height;
  roundedRectangle(
    context.page,
    MARGIN,
    bottom,
    CONTENT_WIDTH,
    height,
    8,
    TEAL_LIGHT,
    rgb(0.58, 0.81, 0.76),
  );
  roundedRectangle(
    context.page,
    MARGIN + 14,
    context.y - 47,
    40,
    40,
    7,
    TEAL_DARK,
  );
  context.page.drawText('FHIR', {
    x: centeredX(context.bold, 'FHIR', 7.8, MARGIN + 14, 40),
    y: context.y - 32,
    font: context.bold,
    size: 7.8,
    color: WHITE,
  });
  context.page.drawText('Machine-readable attachment', {
    x: MARGIN + 67,
    y: context.y - 27,
    font: context.bold,
    size: 10,
    color: INK,
  });
  const message =
    'The exact HL7 FHIR document Bundle used for this PDF is embedded as medipass-ips.fhir.json (application/fhir+json). Some PDF viewers hide file attachments. Clinical systems should ingest and validate the JSON Bundle, not extract clinical facts from the visual PDF.';
  drawLines(
    context.page,
    wrap(message, context.regular, 7.6, CONTENT_WIDTH - 96),
    {
      x: MARGIN + 67,
      y: context.y - 47,
      font: context.regular,
      size: 7.6,
      color: MUTED,
      lineHeight: 10,
    },
  );
  context.y = bottom - 20;
}

function drawSafetyNotices(context: PdfContext): void {
  const gap = 10;
  const width = (CONTENT_WIDTH - gap) / 2;
  const privacy =
    'This document contains identifiable health information. Store and transmit it securely, verify the intended recipient, and delete unnecessary copies. No data is sent to a third party by the export action itself.';
  const clinical =
    'Before relying on this summary - especially for emergency care, travel, medication purchase, or medication conversion - ask a qualified clinician or pharmacist to reconcile it with the patient, original labels, prescriptions, and current clinical status.';
  const privacyLines = wrap(privacy, context.regular, 7.6, width - 28);
  const clinicalLines = wrap(clinical, context.regular, 7.6, width - 28);
  const height = Math.max(
    124,
    46 + Math.max(privacyLines.length, clinicalLines.length) * 10,
  );
  ensureSpace(context, height);
  const bottom = context.y - height;
  roundedRectangle(
    context.page,
    MARGIN,
    bottom,
    width,
    height,
    8,
    CORAL_LIGHT,
    CORAL_BORDER,
  );
  roundedRectangle(
    context.page,
    MARGIN + width + gap,
    bottom,
    width,
    height,
    8,
    AMBER_LIGHT,
    AMBER_BORDER,
  );
  context.page.drawText('Privacy', {
    x: MARGIN + 14,
    y: context.y - 26,
    font: context.bold,
    size: 9.8,
    color: INK,
  });
  drawLines(context.page, privacyLines, {
    x: MARGIN + 14,
    y: context.y - 49,
    font: context.regular,
    size: 7.6,
    color: MUTED,
    lineHeight: 10,
  });
  context.page.drawText('Clinical review', {
    x: MARGIN + width + gap + 14,
    y: context.y - 26,
    font: context.bold,
    size: 9.5,
    color: INK,
  });
  drawLines(context.page, clinicalLines, {
    x: MARGIN + width + gap + 14,
    y: context.y - 49,
    font: context.regular,
    size: 7.6,
    color: MUTED,
    lineHeight: 10,
  });
  context.y = bottom - 20;
}

function drawPreliminaryBanner(context: PdfContext): void {
  const height = 49;
  ensureSpace(context, height);
  const bottom = context.y - height;
  roundedRectangle(
    context.page,
    MARGIN,
    bottom,
    CONTENT_WIDTH,
    height,
    7,
    NAVY,
  );
  context.page.drawCircle({
    x: MARGIN + 24,
    y: bottom + height / 2,
    size: 8,
    color: AMBER,
  });
  context.page.drawText('!', {
    x: centeredX(context.bold, '!', 8, MARGIN + 16, 16),
    y: bottom + height / 2 - 2.7,
    font: context.bold,
    size: 8,
    color: NAVY,
  });
  context.page.drawText('PRELIMINARY DOCUMENT', {
    x: MARGIN + 43,
    y: bottom + 22,
    font: context.bold,
    size: 8.7,
    color: WHITE,
  });
  context.page.drawText(
    'This summary has not been digitally signed or attested by a clinician.',
    {
      x: MARGIN + 184,
      y: bottom + 22,
      font: context.bold,
      size: 7.1,
      color: WHITE,
    },
  );
  context.y = bottom - 8;
}

function addPageFurniture(context: PdfContext): void {
  const pages = context.document.getPages();
  pages.forEach((page, index) => {
    page.drawLine({
      start: { x: MARGIN, y: 43 },
      end: { x: PAGE_WIDTH - MARGIN, y: 43 },
      thickness: 0.6,
      color: BORDER,
    });
    page.drawText(
      'Sensitive personal health information',
      {
        x: MARGIN,
        y: 27,
        font: context.regular,
        size: 6.4,
        color: MUTED,
      },
    );
    const pageNumber = String(index + 1) + ' / ' + String(pages.length);
    page.drawText(pageNumber, {
      x: rightAlignedX(context.bold, pageNumber, 6.5, PAGE_WIDTH - MARGIN),
      y: 27,
      font: context.bold,
      size: 6.5,
      color: MUTED,
    });
    if (index > 0) {
      const pageLabel =
        'PAGE ' + String(index + 1) + ' OF ' + String(pages.length);
      page.drawText(pageLabel, {
        x: rightAlignedX(context.bold, pageLabel, 7.2, PAGE_WIDTH - MARGIN),
        y: PAGE_HEIGHT - 35,
        font: context.bold,
        size: 7.2,
        color: rgb(0.78, 0.89, 0.91),
      });
    }
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
  const regular = await document.embedFont(regularFontBytes, {
    subset: false,
  });
  const bold = await document.embedFont(boldFontBytes, { subset: false });
  const firstPage = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  preparePage(firstPage);
  const medicalRecordNumber =
    clean(snapshot.patient.medical_record_number) ||
    'Unavailable';
  const context: PdfContext = {
    document,
    regular,
    bold,
    page: firstPage,
    y: 0,
    medicalRecordNumber,
  };
  const generatedAt = bundle.timestamp;
  const patientName =
    clean(snapshot.patient.display_name) || 'Name unavailable';

  document.setTitle('International Patient Summary - ' + patientName);
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

  drawHero(context, generatedAt);
  drawPatientCard(context, snapshot);
  const details = drawClinicalEssentials(context, snapshot);
  drawMedicationSafety(context);
  drawVitals(context, snapshot);
  drawCurrentPlan(context, snapshot);

  addContinuationPage(context);
  drawSectionHeading(context, 4, 'Clinical details', 'Detailed record');
  drawCompleteLists(context, snapshot, details);
  drawProcedures(context, snapshot);
  drawDiagnostics(context, snapshot);
  drawProvenance(context, snapshot, bundle);
  drawAttachmentNotice(context);
  drawSafetyNotices(context);
  drawPreliminaryBanner(context);

  const bundleBytes = new TextEncoder().encode(JSON.stringify(bundle, null, 2));
  await document.attach(bundleBytes, 'medipass-ips.fhir.json', {
    mimeType: 'application/fhir+json',
    description: 'HL7 FHIR R4 International Patient Summary document Bundle',
    creationDate: new Date(generatedAt),
    modificationDate: new Date(generatedAt),
  });

  addPageFurniture(context);
  return document.save({ useObjectStreams: false });
}
