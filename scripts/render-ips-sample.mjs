import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildIpsBundle, createIpsSnapshot } from '../lib/ips.ts';
import { buildIpsPdf } from '../lib/ips-pdf.ts';
import { demoEncounters, demoPatients } from '../lib/portal-seed.ts';

const patient = demoPatients()[0];
patient.display_name = 'Bệnh nhân Demo Quốc tế';
patient.medical_record_number = 'MP-IPS-DEMO';
patient.conditions.push({
  id: 'c-demo-diabetes',
  name: 'Đái tháo đường típ 2',
  clinical_term: 'Type 2 diabetes mellitus',
  since: '2024',
  status: 'active',
  note: 'Tình trạng giả lập bổ sung để kiểm tra bản xuất.',
});

const sourceEncounter = demoEncounters().find(
  (encounter) =>
    encounter.patient_id === 'patient-tuan' &&
    encounter.visit_date === '2026-09-07',
);
if (!sourceEncounter) throw new Error('Synthetic source encounter not found');
const encounter = {
  ...sourceEncounter,
  id: 'visit-ips-sample',
  patient_id: patient.id,
  reason: 'International travel health-summary review',
  diagnosis: 'Asthma and type 2 diabetes — follow-up',
  plain_diagnosis: 'Theo dõi hen và đái tháo đường típ 2',
  blood_pressure: '128/78',
  pulse: '74',
  oxygen_saturation: '98',
  temperature: '36.8',
  weight: '61',
  medications: [
    ...sourceEncounter.medications,
    {
      id: 'med-albuterol-sample',
      name: 'Albuterol inhaler',
      dose: '90 mcg/nhát xịt',
      route: 'Hít',
      frequency: 'Theo chỉ định trên đơn',
      duration: 'Đang dùng',
      status: 'active',
      instructions:
        'Minh họa thuốc trong hồ sơ; phải xác nhận với bác sĩ hoặc pharmacist.',
    },
    {
      id: 'med-unmapped-sample',
      name: 'Ferrous sulfate',
      dose: 'Theo đơn đã kê',
      route: 'Uống',
      frequency: 'Theo đơn bác sĩ',
      duration: 'Đang theo dõi',
      status: 'active',
      instructions: 'Mục cố ý để minh họa trạng thái chưa ánh xạ INN/ATC.',
    },
  ],
  procedures: [
    {
      id: 'procedure-sample',
      name: 'Medication reconciliation',
      result: 'Reviewed against the synthetic patient list',
      explanation: 'Bản demo minh họa việc rà soát thuốc trước khi đi quốc tế.',
    },
  ],
};
const snapshot = createIpsSnapshot(
  patient,
  [encounter],
  'Synthetic local sample data',
);
const bundle = buildIpsBundle(snapshot, {
  now: '2026-09-10T17:25:00.000Z',
  idFactory: (() => {
    let id = 0;
    return () =>
      `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`;
  })(),
});
const [regular, bold] = await Promise.all([
  readFile(resolve('node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf')),
  readFile(resolve('node_modules/dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf')),
]);
const pdf = await buildIpsPdf(snapshot, bundle, regular, bold);
const outputDirectory = resolve('output/pdf');
await mkdir(outputDirectory, { recursive: true });
const outputPath = resolve(outputDirectory, 'medipass-ips-sample.pdf');
await writeFile(outputPath, pdf);
console.log(outputPath);
