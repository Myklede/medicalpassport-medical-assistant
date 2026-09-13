/** Immutable synthetic clinical records. Not authentication or the Supabase portal. */
export type WoundMeasurementFlag = 'normal' | 'high' | 'low' | 'recorded';
export type WoundClinicalMeasurement = Readonly<{
  code: 'BP' | 'FPG' | 'HbA1c' | 'CRP' | 'WBC' | 'eGFR';
  label: string; value: string | number; unit: string; reference_range: string;
  flag: WoundMeasurementFlag; recorded_at: string;
}>;
export type WoundClinicalMedication = Readonly<{
  name: string; strength: string; dose: string; route: string;
  schedule: string; status: string; note: string;
}>;
export type WoundClinicalVisit = Readonly<{
  visit_id: string; date: string; encounter_type: string;
  clinician: Readonly<{ name: string; specialty: string }>;
  summary: string; summary_tone: 'routine' | 'improving' | 'review';
  measurements: readonly WoundClinicalMeasurement[];
  wound: Readonly<{
    site: string; length_cm: number; width_cm: number; depth_cm: number; recorded_area_cm2: number;
    edge_state: string; exudate: string; surrounding_skin: string; pain_score: number;
    tissue_percentages: Readonly<{ granulation: number; slough: number; necrotic: number }>;
    measurement_note: string; procedures: readonly string[];
  }>;
  medications: readonly WoundClinicalMedication[];
  dressings: readonly Readonly<{ name: string; application: string; schedule: string }>[];
  care: Readonly<{
    offloading: string; dressing_protocol: string; monitoring: string;
    follow_up_date: string; follow_up_location: string; additional_notes: readonly string[];
  }>;
  record_source: string;
}>;
export type WoundPatient = Readonly<{
  patient_id: string; display_name: string; age: number; blood_type: string;
  hba1c_level: number; has_diabetes_type_2: boolean; hypertension: boolean;
  fpg_mg_dl: number | null; peripheral_vascular_status: 'normal' | 'impaired' | 'unknown';
  vascular_notes: string; neuropathy_status: 'present' | 'absent' | 'unknown';
  neuropathy_notes: string; baseline_recorded_at: string; clinical_visits: readonly WoundClinicalVisit[];
}>;

function immutable<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(immutable);
    Object.freeze(value);
  }
  return value;
}

type VisitObservation = Readonly<{
  date: string; follow_up_date: string; bp: readonly [number, number];
  fpg: number; crp: number; wbc: number; egfr: number;
  dimensions: readonly [number, number, number]; area: number; tissue: readonly [number, number, number];
  edge: string; exudate: string; skin: string; pain: number; procedures: readonly string[];
  dressing: 'Foam' | 'Hydrogel' | 'Alginate'; summary: string; tone: WoundClinicalVisit['summary_tone'];
}>;
const BASELINE_DATE = '2026-08-28';

function laboratoryMeasurements(observation: VisitObservation, hba1c: number): readonly WoundClinicalMeasurement[] {
  const { date, bp, fpg, crp, wbc, egfr } = observation;
  return [
    { code: 'BP', label: 'Huyết áp', value: `${bp[0]}/${bp[1]}`, unit: 'mmHg', reference_range: '90–129 / 60–79 (khoảng ghi trên phiếu mẫu)', flag: bp[0] >= 130 || bp[1] >= 80 ? 'high' : bp[0] < 90 || bp[1] < 60 ? 'low' : 'normal', recorded_at: date },
    { code: 'FPG', label: 'Đường huyết lúc đói', value: fpg, unit: 'mg/dL', reference_range: '70–99', flag: fpg > 99 ? 'high' : fpg < 70 ? 'low' : 'normal', recorded_at: date },
    { code: 'HbA1c', label: 'HbA1c', value: hba1c, unit: '%', reference_range: '4.0–5.6 (tham chiếu xét nghiệm; không phải mục tiêu điều trị)', flag: hba1c > 5.6 ? 'high' : hba1c < 4 ? 'low' : 'normal', recorded_at: BASELINE_DATE },
    { code: 'CRP', label: 'Protein phản ứng C', value: crp, unit: 'mg/L', reference_range: '0–5', flag: crp > 5 ? 'high' : 'normal', recorded_at: date },
    { code: 'WBC', label: 'Bạch cầu', value: wbc, unit: '×10⁹/L', reference_range: '4.0–10.0', flag: wbc > 10 ? 'high' : wbc < 4 ? 'low' : 'normal', recorded_at: date },
    { code: 'eGFR', label: 'Mức lọc cầu thận ước tính', value: egfr, unit: 'mL/min/1.73 m²', reference_range: '≥ 60 (khoảng ghi trên phiếu mẫu)', flag: egfr < 60 ? 'low' : 'normal', recorded_at: date },
  ];
}

function clinicalVisits(patientId: string, hba1c: number, site: string,
  clinician: WoundClinicalVisit['clinician'], medications: readonly WoundClinicalMedication[],
  offloading: string, observations: readonly VisitObservation[]): readonly WoundClinicalVisit[] {
  return observations.map((o, index) => ({
    visit_id: `${patientId}-clinical-${o.date}`, date: o.date,
    encounter_type: index === 0 ? 'Khám vết thương ban đầu' : 'Tái khám & thay băng', clinician,
    summary: o.summary, summary_tone: o.tone, measurements: laboratoryMeasurements(o, hba1c),
    wound: { site, length_cm: o.dimensions[0], width_cm: o.dimensions[1], depth_cm: o.dimensions[2],
      recorded_area_cm2: o.area, edge_state: o.edge, exudate: o.exudate, surrounding_skin: o.skin, pain_score: o.pain,
      tissue_percentages: { granulation: o.tissue[0], slough: o.tissue[1], necrotic: o.tissue[2] },
      measurement_note: 'Số đo và tỷ lệ mô do người khám ghi trong hồ sơ giả lập; không lấy từ ảnh mới tải lên. Diện tích được ghi riêng, không suy ra bằng chiều dài × chiều rộng.', procedures: o.procedures,
    },
    medications,
    dressings: [{ name: o.dressing,
      application: o.dressing === 'Foam' ? 'Băng foam silicone 10 × 10 cm, phủ vùng đã làm sạch.' : o.dressing === 'Hydrogel' ? 'Hydrogel vô khuẩn dạng gel, lớp mỏng trên vùng mô vàng được chỉ định; gạc thứ cấp không dính.' : 'Alginate calcium 5 × 5 cm trên vùng tiết dịch; phủ băng thứ cấp không dính.',
      schedule: o.dressing === 'Hydrogel' ? 'Mỗi 24 giờ theo phiếu chăm sóc mẫu.' : 'Mỗi 48 giờ hoặc sớm hơn nếu băng bão hòa theo phiếu chăm sóc mẫu.',
    }],
    care: { offloading,
      dressing_protocol: 'Phiếu mẫu ghi: rửa tay, tháo băng cũ, làm sạch bằng NaCl 0.9%, thấm khô da xung quanh và đặt băng đã chỉ định. Không tự thêm chất sát khuẩn hoặc tự cắt lọc.',
      monitoring: 'Theo phiếu mẫu: ghi ngày thay băng, lượng dịch, đau, đỏ lan và nhiệt độ; liên hệ cơ sở chăm sóc khi có thay đổi so với lần khám.',
      follow_up_date: o.follow_up_date, follow_up_location: 'Phòng chăm sóc vết thương MediPass — cơ sở giả lập',
      additional_notes: [`Kế hoạch ghi nhận trong lần khám ${o.date}; cần người điều trị đối chiếu lại ở lần khám tiếp theo.`, 'HbA1c là kết quả nền ngày 28/08/2026 được mang sang hồ sơ, không phải xét nghiệm mới trong mỗi lần thay băng.'],
    },
    record_source: 'Hồ sơ khám tổng hợp để trình diễn · bệnh nhân, bác sĩ, xét nghiệm và kế hoạch đều là dữ liệu giả lập.',
  }));
}

const metformin: WoundClinicalMedication = { name: 'Metformin', strength: '500 mg / viên', dose: '1 viên (500 mg)', route: 'Uống', schedule: '2 lần/ngày, sau bữa sáng và tối', status: 'Tiếp tục theo đơn mẫu', note: 'Thuốc nền ghi trong hồ sơ giả lập; không tự chỉnh liều theo phân tích ảnh.' };
const amlodipine: WoundClinicalMedication = { name: 'Amlodipine', strength: '5 mg / viên', dose: '1 viên (5 mg)', route: 'Uống', schedule: '1 lần/ngày vào buổi sáng', status: 'Tiếp tục theo đơn mẫu', note: 'Đối chiếu lại danh sách thuốc khi tái khám.' };

export const MOCK_WOUND_PATIENTS: readonly WoundPatient[] = immutable([
  {
    patient_id: 'SYN000014', display_name: 'An Nguyễn', age: 20, blood_type: 'A-', hba1c_level: 9.6, has_diabetes_type_2: true, hypertension: false,
    fpg_mg_dl: 218, peripheral_vascular_status: 'impaired', vascular_notes: 'Phiếu mẫu: đầu chi hơi lạnh, mạch mu chân sờ yếu; đang chờ đánh giá tưới máu. Chưa xác nhận bệnh động mạch ngoại biên.',
    neuropathy_status: 'present', neuropathy_notes: 'Phiếu mẫu ghi giảm cảm giác bảo vệ qua khám bàn chân.', baseline_recorded_at: BASELINE_DATE,
    clinical_visits: clinicalVisits('SYN000014', 9.6, 'Mặt gan bàn chân phải, dưới chỏm xương bàn I', { name: 'BS. Mai Phương', specialty: 'Nội tiết & chăm sóc vết thương' }, [metformin], 'Phiếu mẫu: dùng giày giảm tải đã được đo vừa; hạn chế tì trực tiếp lên vùng tổn thương; kiểm tra điểm tì mỗi ngày.', [
      { date: '2026-09-01', follow_up_date: '2026-09-05', bp: [118, 74], fpg: 218, crp: 6.2, wbc: 8.9, egfr: 108, dimensions: [2.4, 1.8, 0.2], area: 3.8, tissue: [40, 50, 10], edge: 'Bờ chai nhẹ, chưa biểu mô hóa rõ.', exudate: 'Dịch thanh vàng mức vừa; không ghi mủ.', skin: 'Da quanh hơi khô, không ghi đỏ lan.', pain: 1, procedures: ['Làm sạch bằng NaCl 0.9%.', 'Cắt lọc chọn lọc lớp chai nông do người khám thực hiện; kiểm tra cảm giác và mạch ngoại vi.'], dressing: 'Foam', summary: 'Thiết lập mốc theo dõi', tone: 'routine' },
      { date: '2026-09-05', follow_up_date: '2026-09-09', bp: [120, 76], fpg: 210, crp: 6, wbc: 8.7, egfr: 108, dimensions: [2.4, 1.8, 0.2], area: 3.8, tissue: [41, 49, 10], edge: 'Bờ chai còn, mép chưa khép thêm.', exudate: 'Dịch thanh vàng mức vừa.', skin: 'Da quanh nguyên vẹn, hơi khô.', pain: 1, procedures: ['Làm sạch bằng NaCl 0.9%.', 'Đánh giá lại độ vừa của giày giảm tải; chưa cắt lọc thêm.'], dressing: 'Foam', summary: 'Kích thước gần như giữ nguyên', tone: 'review' },
      { date: '2026-09-09', follow_up_date: '2026-09-12', bp: [118, 72], fpg: 216, crp: 6.3, wbc: 8.8, egfr: 107, dimensions: [2.4, 1.8, 0.2], area: 3.8, tissue: [40, 50, 10], edge: 'Bờ chưa tiến triển rõ sau 8 ngày.', exudate: 'Dịch mức vừa, tương tự lần trước.', skin: 'Không ghi đỏ lan; đầu ngón hơi lạnh khi khám.', pain: 1, procedures: ['Làm sạch và thay băng foam.', 'Ghi nhận đình trệ; chuyển đánh giá tưới máu và rà soát kiểm soát đường huyết.'], dressing: 'Foam', summary: 'Cần rà soát chậm liền thương', tone: 'review' },
      { date: '2026-09-12', follow_up_date: '2026-09-15', bp: [120, 74], fpg: 208, crp: 6.1, wbc: 8.6, egfr: 108, dimensions: [2.4, 1.8, 0.2], area: 3.79, tissue: [41, 49, 10], edge: 'Thay đổi rất ít, còn bờ chai mỏng.', exudate: 'Dịch mức vừa; chưa ghi dấu hiệu mới.', skin: 'Da quanh không rách, không ghi đỏ lan.', pain: 1, procedures: ['Làm sạch bằng NaCl 0.9%, thay băng.', 'Kiểm tra lại giảm tải; giữ lịch đánh giá tưới máu và nội tiết đã đặt.'], dressing: 'Foam', summary: 'Tiếp tục theo dõi sát', tone: 'review' },
    ]),
  },
  {
    patient_id: 'MOCK-002', display_name: 'Bình Trần', age: 34, blood_type: 'O+', hba1c_level: 5.2, has_diabetes_type_2: false, hypertension: false,
    fpg_mg_dl: 91, peripheral_vascular_status: 'normal', vascular_notes: 'Phiếu khám mẫu ghi chi ấm, mạch ngoại vi rõ, thời gian hồi màu mao mạch dưới 2 giây.', neuropathy_status: 'absent', neuropathy_notes: 'Phiếu mẫu ghi cảm giác bảo vệ còn.', baseline_recorded_at: BASELINE_DATE,
    clinical_visits: clinicalVisits('MOCK-002', 5.2, 'Mặt trước cẳng chân trái — trầy xước sau va chạm trong tình huống giả lập', { name: 'BS. Hoàng Minh', specialty: 'Ngoại tổng quát' }, [], 'Phiếu mẫu: tránh cọ xát và đè trực tiếp lên vùng băng; điều chỉnh hoạt động theo lịch khám.', [
      { date: '2026-09-01', follow_up_date: '2026-09-05', bp: [116, 72], fpg: 91, crp: 2.1, wbc: 6.4, egfr: 112, dimensions: [3, 2, 0.1], area: 5, tissue: [70, 30, 0], edge: 'Bờ nông, đều.', exudate: 'Dịch thanh trong ít.', skin: 'Da quanh nguyên vẹn.', pain: 3, procedures: ['Rửa sạch bằng NaCl 0.9%; lấy bỏ dị vật nông đã thấy khi khám.', 'Đối chiếu lịch tiêm chủng trong hồ sơ mẫu.'], dressing: 'Foam', summary: 'Vết thương nông, lập hồ sơ', tone: 'routine' },
      { date: '2026-09-05', follow_up_date: '2026-09-09', bp: [114, 72], fpg: 90, crp: 1.8, wbc: 6.2, egfr: 112, dimensions: [2.6, 1.7, 0.1], area: 3.7, tissue: [82, 18, 0], edge: 'Có dải biểu mô mỏng từ bờ.', exudate: 'Ít dịch thanh trong.', skin: 'Da quanh khô, không ghi sưng.', pain: 2, procedures: ['Làm sạch nhẹ bằng NaCl 0.9%; thay băng.', 'Đo lại kích thước cùng vị trí.'], dressing: 'Foam', summary: 'Thu nhỏ và tăng mô hạt', tone: 'improving' },
      { date: '2026-09-09', follow_up_date: '2026-09-12', bp: [116, 70], fpg: 92, crp: 1.2, wbc: 6.1, egfr: 113, dimensions: [2, 1.2, 0.1], area: 1.9, tissue: [94, 6, 0], edge: 'Biểu mô hóa từ các bờ.', exudate: 'Rất ít dịch.', skin: 'Không ghi đỏ lan hoặc sưng.', pain: 1, procedures: ['Làm sạch, thay băng foam bảo vệ.', 'Không có chỉ định cắt lọc thêm trong phiếu mẫu.'], dressing: 'Foam', summary: 'Tiếp tục thu nhỏ', tone: 'improving' },
      { date: '2026-09-12', follow_up_date: '2026-09-19', bp: [116, 72], fpg: 91, crp: 1, wbc: 6, egfr: 112, dimensions: [1.3, 0.8, 0.1], area: 0.8, tissue: [100, 0, 0], edge: 'Bờ tiến sát nhau, còn vùng hở nông.', exudate: 'Tối thiểu.', skin: 'Da quanh nguyên vẹn.', pain: 0, procedures: ['Làm sạch, bảo vệ vùng chưa kín bằng băng foam.', 'Ghi nhận chưa khép kín hoàn toàn; hẹn đánh giá lại.'], dressing: 'Foam', summary: 'Vùng hở nhỏ dần', tone: 'improving' },
    ]),
  },
  {
    patient_id: 'MOCK-003', display_name: 'Chi Lê', age: 67, blood_type: 'B+', hba1c_level: 7.1, has_diabetes_type_2: true, hypertension: true,
    fpg_mg_dl: 142, peripheral_vascular_status: 'unknown', vascular_notes: 'Có phù cổ chân nhẹ trong phiếu mẫu; chưa có kết quả đo tưới máu động mạch để phân loại.', neuropathy_status: 'present', neuropathy_notes: 'Phiếu mẫu ghi cảm giác rung giảm hai bàn chân.', baseline_recorded_at: BASELINE_DATE,
    clinical_visits: clinicalVisits('MOCK-003', 7.1, 'Mặt ngoài cổ chân phải', { name: 'BS. Mai Phương', specialty: 'Nội tiết & chăm sóc vết thương' }, [metformin, amlodipine], 'Phiếu mẫu: tránh giày cọ vào mắt cá; đệm bảo vệ theo hướng dẫn đã ghi; chưa bắt đầu ép áp lực khi chưa có đánh giá tưới máu.', [
      { date: '2026-09-01', follow_up_date: '2026-09-05', bp: [138, 82], fpg: 142, crp: 4.8, wbc: 7.7, egfr: 66, dimensions: [2.8, 2, 0.2], area: 4.6, tissue: [50, 45, 5], edge: 'Bờ không đều, còn ít giả mạc.', exudate: 'Vừa, dịch thanh vàng.', skin: 'Phù cổ chân nhẹ; không ghi đỏ lan.', pain: 2, procedures: ['Làm sạch bằng NaCl 0.9%.', 'Cắt lọc chọn lọc mô vàng nông tại cơ sở theo phiếu mẫu.'], dressing: 'Alginate', summary: 'Theo dõi mô vàng và tiết dịch', tone: 'routine' },
      { date: '2026-09-05', follow_up_date: '2026-09-09', bp: [132, 80], fpg: 138, crp: 4.2, wbc: 7.4, egfr: 67, dimensions: [2.7, 1.9, 0.2], area: 4.2, tissue: [58, 39, 3], edge: 'Một phần bờ có biểu mô mỏng.', exudate: 'Vừa, giảm so với lần đầu.', skin: 'Phù nhẹ còn; không ghi tổn thương da mới.', pain: 2, procedures: ['Rửa sạch; thay alginate và băng thứ cấp.', 'Đánh giá lại da quanh và mức tiết dịch.'], dressing: 'Alginate', summary: 'Mô hạt tăng nhẹ', tone: 'improving' },
      { date: '2026-09-09', follow_up_date: '2026-09-12', bp: [128, 78], fpg: 136, crp: 3.8, wbc: 7.2, egfr: 67, dimensions: [2.5, 1.8, 0.2], area: 3.7, tissue: [65, 33, 2], edge: 'Bờ mềm hơn, biểu mô hóa từng đoạn.', exudate: 'Ít đến vừa.', skin: 'Phù nhẹ, không ghi đỏ lan.', pain: 1, procedures: ['Làm sạch; chuyển sang foam do dịch giảm trong ghi nhận mẫu.', 'Giữ lịch khảo sát tưới máu.'], dressing: 'Foam', summary: 'Diện tích giảm từ từ', tone: 'improving' },
      { date: '2026-09-12', follow_up_date: '2026-09-19', bp: [128, 76], fpg: 134, crp: 3.5, wbc: 7.1, egfr: 68, dimensions: [2.3, 1.6, 0.15], area: 3.1, tissue: [73, 26, 1], edge: 'Biểu mô hóa tiếp từ bờ.', exudate: 'Ít.', skin: 'Phù nhẹ không tăng.', pain: 1, procedures: ['Làm sạch và thay foam.', 'Rà soát lịch thuốc nền và lịch xét nghiệm với người khám.'], dressing: 'Foam', summary: 'Tiếp tục cải thiện trên hồ sơ', tone: 'improving' },
    ]),
  },
  {
    patient_id: 'MOCK-004', display_name: 'Dung Phạm', age: 49, blood_type: 'AB-', hba1c_level: 5.6, has_diabetes_type_2: false, hypertension: true,
    fpg_mg_dl: 98, peripheral_vascular_status: 'normal', vascular_notes: 'Phiếu mẫu ghi mạch ngoại vi rõ, chi ấm và không phù.', neuropathy_status: 'absent', neuropathy_notes: 'Khám cảm giác bảo vệ được ghi nhận bình thường trong phiếu mẫu.', baseline_recorded_at: BASELINE_DATE,
    clinical_visits: clinicalVisits('MOCK-004', 5.6, 'Mặt trước cẳng chân phải — vết thương nông trong tình huống giả lập', { name: 'BS. Hoàng Minh', specialty: 'Ngoại tổng quát' }, [amlodipine], 'Phiếu mẫu: bảo vệ cẳng chân khỏi tì đè và cọ xát khi làm việc; nghỉ xen kẽ theo kế hoạch cá nhân đã ghi.', [
      { date: '2026-09-01', follow_up_date: '2026-09-05', bp: [144, 88], fpg: 98, crp: 3.2, wbc: 7, egfr: 92, dimensions: [2.1, 1.5, 0.1], area: 2.6, tissue: [45, 55, 0], edge: 'Bờ khô, lớp mô vàng mỏng.', exudate: 'Ít; nền hơi khô.', skin: 'Da quanh nguyên vẹn.', pain: 3, procedures: ['Làm sạch bằng NaCl 0.9%.', 'Ghi nhận mô vàng nông, đặt hydrogel theo phiếu mẫu.'], dressing: 'Hydrogel', summary: 'Chăm sóc nền khô và mô vàng', tone: 'routine' },
      { date: '2026-09-05', follow_up_date: '2026-09-09', bp: [138, 84], fpg: 97, crp: 2.8, wbc: 6.8, egfr: 93, dimensions: [1.9, 1.3, 0.1], area: 2.1, tissue: [65, 35, 0], edge: 'Bờ bớt khô, không ghi cuộn mép.', exudate: 'Ít dịch thanh trong.', skin: 'Không ghi maceration.', pain: 2, procedures: ['Làm sạch; loại bỏ mô vàng lỏng bằng gạc tại cơ sở.', 'Đánh giá nền ẩm trước thay hydrogel.'], dressing: 'Hydrogel', summary: 'Mô vàng giảm', tone: 'improving' },
      { date: '2026-09-09', follow_up_date: '2026-09-12', bp: [130, 80], fpg: 98, crp: 2.1, wbc: 6.6, egfr: 92, dimensions: [1.6, 1.1, 0.1], area: 1.4, tissue: [85, 15, 0], edge: 'Biểu mô mới từ bờ.', exudate: 'Ít.', skin: 'Da quanh bình thường theo phiếu.', pain: 1, procedures: ['Làm sạch; chuyển sang foam khi nền mô vàng giảm.', 'Đo huyết áp và đối chiếu thuốc mẫu.'], dressing: 'Foam', summary: 'Vết thương thu nhỏ', tone: 'improving' },
      { date: '2026-09-12', follow_up_date: '2026-09-19', bp: [126, 78], fpg: 96, crp: 1.7, wbc: 6.5, egfr: 94, dimensions: [1.2, 0.8, 0.1], area: 0.7, tissue: [96, 4, 0], edge: 'Biểu mô hóa rõ, còn vùng hở nhỏ.', exudate: 'Tối thiểu.', skin: 'Không ghi vấn đề mới.', pain: 0, procedures: ['Làm sạch; băng foam bảo vệ.', 'Ghi hẹn đánh giá khép kín ở lần tiếp theo.'], dressing: 'Foam', summary: 'Tiếp tục biểu mô hóa', tone: 'improving' },
    ]),
  },
  {
    patient_id: 'MOCK-005', display_name: 'Hải Võ', age: 81, blood_type: 'O-', hba1c_level: 10.4, has_diabetes_type_2: true, hypertension: true,
    fpg_mg_dl: 246, peripheral_vascular_status: 'impaired', vascular_notes: 'Phiếu mẫu ghi mạch chày sau yếu, ngón chân lạnh; bác sĩ đã đặt lịch đánh giá mạch máu. Không suy ra mức thiếu máu từ ảnh.', neuropathy_status: 'present', neuropathy_notes: 'Phiếu mẫu ghi giảm cảm giác bảo vệ và tê bàn chân hai bên.', baseline_recorded_at: BASELINE_DATE,
    clinical_visits: clinicalVisits('MOCK-005', 10.4, 'Gót chân trái', { name: 'BS. Lê Thanh', specialty: 'Lão khoa & phối hợp mạch máu' }, [
      { name: 'Insulin glargine', strength: '100 đơn vị/mL', dose: '12 đơn vị', route: 'Tiêm dưới da', schedule: '21:00 mỗi ngày theo đơn mẫu', status: 'Đơn nền được đối chiếu tại lần khám', note: 'Liều giả lập đã ghi; mọi thay đổi liều phải do người kê đơn đánh giá.' }, amlodipine,
    ], 'Phiếu mẫu: dùng dụng cụ kê treo gót đã được hướng dẫn, tránh tì trực tiếp lên gót khi nằm; người chăm sóc hỗ trợ thay đổi tư thế theo kế hoạch đã ghi.', [
      { date: '2026-09-01', follow_up_date: '2026-09-05', bp: [150, 86], fpg: 246, crp: 8.6, wbc: 9.4, egfr: 43, dimensions: [3.5, 2.8, 0.3], area: 8.1, tissue: [25, 45, 30], edge: 'Bờ ít biểu mô; có vùng mô đen khô ở ngoại vi.', exudate: 'Vừa tại phần nền hở.', skin: 'Chi lạnh theo khám, da quanh mỏng.', pain: 1, procedures: ['Làm sạch nhẹ phần nền hở bằng NaCl 0.9%.', 'Không cắt lọc vùng đen khô khi chưa có đánh giá tưới máu; gửi chuyên khoa mạch máu theo phiếu.'], dressing: 'Foam', summary: 'Cần đánh giá tưới máu', tone: 'review' },
      { date: '2026-09-05', follow_up_date: '2026-09-09', bp: [146, 84], fpg: 238, crp: 9.1, wbc: 9.6, egfr: 43, dimensions: [3.5, 2.8, 0.3], area: 8.1, tissue: [24, 45, 31], edge: 'Bờ không thay đổi rõ.', exudate: 'Vừa, không ghi mủ.', skin: 'Gót còn chịu tì từng lúc theo người chăm sóc.', pain: 1, procedures: ['Làm sạch phần hở; thay foam bảo vệ.', 'Điều chỉnh dụng cụ treo gót; nhắc lịch chuyên khoa đã đặt.'], dressing: 'Foam', summary: 'Chưa ghi nhận thu nhỏ', tone: 'review' },
      { date: '2026-09-09', follow_up_date: '2026-09-12', bp: [144, 82], fpg: 242, crp: 10.2, wbc: 10.3, egfr: 42, dimensions: [3.6, 2.9, 0.3], area: 8.5, tissue: [20, 45, 35], edge: 'Mép chưa khép, vùng mô đen tăng trong ghi nhận.', exudate: 'Vừa, tăng nhẹ ở nền hở.', skin: 'Da quanh hơi đỏ khu trú theo phiếu; không xác định nhiễm trùng từ màu.', pain: 2, procedures: ['Khám lại trực tiếp, làm sạch nhẹ và băng bảo vệ.', 'Liên hệ chuyên khoa mạch máu trong ngày do thay đổi trên khám; hoãn cắt lọc vùng đen.'], dressing: 'Foam', summary: 'Thay đổi cần bác sĩ xem lại', tone: 'review' },
      { date: '2026-09-12', follow_up_date: '2026-09-14', bp: [140, 80], fpg: 232, crp: 9.8, wbc: 9.9, egfr: 43, dimensions: [3.6, 2.9, 0.3], area: 8.5, tissue: [21, 44, 35], edge: 'Bờ chưa tiến triển thêm.', exudate: 'Vừa, tương tự lần trước.', skin: 'Đỏ khu trú không tăng theo ghi nhận khám.', pain: 2, procedures: ['Làm sạch phần hở, thay foam; kiểm tra điểm tì.', 'Phối hợp chuyên khoa theo lịch; chưa có kết quả tưới máu mới để nhập vào hồ sơ mẫu.'], dressing: 'Foam', summary: 'Theo dõi sát sau tái khám', tone: 'review' },
    ]),
  },
]);

// Simulated signed-in user; mode changes cannot substitute the developer selection.
export const PATIENT_MODE_PROFILE = MOCK_WOUND_PATIENTS[0];

export function woundBaseline(patient: WoundPatient) {
  const { patient_id, age, blood_type, hba1c_level, has_diabetes_type_2, hypertension,
    fpg_mg_dl, peripheral_vascular_status, neuropathy_status } = patient;
  return { patient_id, age, blood_type, hba1c_level, has_diabetes_type_2, hypertension,
    fpg_mg_dl, peripheral_vascular_status, neuropathy_status };
}
