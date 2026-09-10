import type { Lab, Encounter, Medicine } from './portal-types.ts';

export function interpretLab(lab: Lab): { status: 'within' | 'high' | 'low' | 'unknown'; label: string; explanation: string; percent: number | null } {
  const raw = lab.value.trim();
  // Qualitative results and inequalities are never coerced to an exact number.
  const numeric = /^-?\d+(?:[.,]\d+)?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN;
  const low = lab.reference_low;
  const high = lab.reference_high;
  if (!lab.unit.trim() || !Number.isFinite(numeric) || (low === null && high === null) || (low !== null && !Number.isFinite(low)) || (high !== null && !Number.isFinite(high)) || (low !== null && high !== null && low > high)) {
    return { status: 'unknown', label: 'Chưa đủ khoảng tham chiếu', explanation: 'Xem kết quả gốc và phần nhận xét của bác sĩ. Chưa tự phân loại chỉ số này.', percent: null };
  }
  const percent = low !== null && high !== null && high > low ? Math.max(0, Math.min(100, 15 + ((numeric - low) / (high - low)) * 70)) : null;
  if (low !== null && numeric < low) return { status: 'low', label: 'Thấp hơn khoảng', explanation: 'Thấp hơn giới hạn tham chiếu ghi trên phiếu xét nghiệm. Bác sĩ sẽ xem cùng triệu chứng và tiền sử.', percent };
  if (high !== null && numeric > high) return { status: 'high', label: 'Cao hơn khoảng', explanation: 'Cao hơn giới hạn tham chiếu ghi trên phiếu xét nghiệm. Điều này không tự xác định nguyên nhân hay chẩn đoán.', percent };
  return { status: 'within', label: 'Trong khoảng tham chiếu', explanation: 'Nằm trong khoảng ghi trên phiếu. Kết quả này cần được xem cùng các thông tin sức khỏe khác.', percent };
}

export function referenceLabel(lab: Lab): string {
  const low = lab.reference_low, high = lab.reference_high;
  if (low === null && high === null) return lab.reference_text || 'Chưa được nhập';
  const range = low === null ? `≤ ${high}` : high === null ? `≥ ${low}` : `${low} – ${high}`;
  return `${range} ${lab.unit}`.trim();
}

// Match only known test names, never guess from a substring or assign a range.
export function glossaryForLab(name: string) {
  const aliases: Record<string, string> = {
    hba1c: 'hba1c', a1c: 'hba1c', 'hemoglobin a1c': 'hba1c',
    glucose: 'glucose', 'fasting plasma glucose': 'glucose', 'blood glucose': 'glucose',
    hemoglobin: 'hemoglobin', 'hemoglobin (hb)': 'hemoglobin', hb: 'hemoglobin',
    ferritin: 'ferritin', ldl: 'ldl', 'ldl cholesterol': 'ldl', creatinine: 'creatinine',
  };
  return labGlossary[aliases[name.trim().toLowerCase()]];
}

export function currentMedicines(encounters: Encounter[]): Medicine[] {
  const seen = new Set<string>();
  const result: Medicine[] = [];
  for (const encounter of [...encounters].sort((a, b) => b.visit_date.localeCompare(a.visit_date) || b.created_at.localeCompare(a.created_at))) {
    for (const medicine of encounter.medications) {
      const key = `${medicine.name.trim().toLocaleLowerCase()}|${medicine.dose.trim().toLocaleLowerCase()}|${medicine.route.trim().toLocaleLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (medicine.status === 'active') result.push(medicine);
    }
  }
  return result;
}

export const labGuide = 'https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/';
export const labGlossary: Record<string, { plain_name: string; explanation: string; source_url: string }> = {
  hba1c: { plain_name: 'Đường huyết trung bình', explanation: 'HbA1c phản ánh mức đường trong máu trung bình trong khoảng 2–3 tháng. Mục tiêu điều trị của mỗi người có thể khác khoảng tham chiếu.', source_url: 'https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/' },
  glucose: { plain_name: 'Lượng đường trong máu', explanation: 'Đo lượng glucose tại thời điểm lấy mẫu. Cần biết mẫu được lấy lúc đói hay sau ăn để hiểu kết quả.', source_url: 'https://medlineplus.gov/lab-tests/blood-glucose-test/' },
  hemoglobin: { plain_name: 'Chất vận chuyển oxy trong máu', explanation: 'Hemoglobin có trong hồng cầu, giúp đưa oxy đến các cơ quan. Bác sĩ xem chỉ số này cùng các thành phần khác của công thức máu.', source_url: 'https://medlineplus.gov/lab-tests/hemoglobin-test/' },
  ferritin: { plain_name: 'Lượng sắt dự trữ', explanation: 'Ferritin giúp đánh giá lượng sắt dự trữ trong cơ thể. Kết quả cũng có thể thay đổi khi có viêm.', source_url: 'https://medlineplus.gov/lab-tests/ferritin-blood-test/' },
  ldl: { plain_name: 'Một loại cholesterol trong máu', explanation: 'LDL mang cholesterol đến các mô. Mục tiêu LDL phụ thuộc nguy cơ tim mạch và kế hoạch riêng của bác sĩ.', source_url: 'https://medlineplus.gov/lab-tests/cholesterol-levels/' },
  creatinine: { plain_name: 'Chỉ số hỗ trợ đánh giá thận', explanation: 'Creatinine là chất thải từ hoạt động của cơ và được thận lọc. Bác sĩ thường xem thêm eGFR và các yếu tố khác.', source_url: 'https://medlineplus.gov/lab-tests/creatinine-test/' },
};
