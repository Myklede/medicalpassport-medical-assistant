import type { Lab, Encounter, Medicine } from './portal-types.ts';

export function interpretLab(lab: Lab): { status: 'within' | 'high' | 'low' | 'unknown'; label: string; explanation: string; percent: number | null } {
  const raw = lab.value.trim();
  // Qualitative results and inequalities are never coerced to an exact number.
  const numeric = /^-?\d+(?:[.,]\d+)?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN;
  const low = lab.reference_low;
  const high = lab.reference_high;
  if (!lab.unit.trim() || !Number.isFinite(numeric) || (low === null && high === null) || (low !== null && !Number.isFinite(low)) || (high !== null && !Number.isFinite(high)) || (low !== null && high !== null && low > high)) {
    return { status: 'unknown', label: 'Chưa đủ dữ liệu để so sánh', explanation: 'Phiếu này chưa có đủ đơn vị hoặc khoảng tham chiếu để app so sánh an toàn. Hãy xem kết quả gốc và nhận xét của bác sĩ.', percent: null };
  }
  const percent = low !== null && high !== null && high > low ? Math.max(0, Math.min(100, 15 + ((numeric - low) / (high - low)) * 70)) : null;
  if (low !== null && numeric < low) return { status: 'low', label: 'Thấp hơn mức trên phiếu', explanation: 'Kết quả thấp hơn mức phòng xét nghiệm ghi là thường gặp. Một con số thấp chưa cho biết nguyên nhân; bác sĩ cần xem cùng triệu chứng và các kết quả khác.', percent };
  if (high !== null && numeric > high) return { status: 'high', label: 'Cao hơn mức trên phiếu', explanation: 'Kết quả cao hơn mức phòng xét nghiệm ghi là thường gặp. Một con số cao chưa đủ để kết luận bệnh hoặc tự thay đổi thuốc.', percent };
  return { status: 'within', label: 'Đang trong mức trên phiếu', explanation: 'Kết quả nằm trong mức phòng xét nghiệm ghi là thường gặp. Đây thường là dấu hiệu yên tâm hơn, nhưng vẫn cần xem cùng triệu chứng và mục tiêu riêng.', percent };
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
export const labGlossary: Record<string, { plain_name: string; explanation: string; impact: string; habits: string; source_url: string }> = {
  hba1c: { plain_name: 'Đường huyết trung bình 2–3 tháng', explanation: 'HbA1c cho biết đường trong máu trung bình trong khoảng 2–3 tháng gần đây, thay vì chỉ tại một thời điểm.', impact: 'Nếu cao kéo dài, nguy cơ tổn thương tim, thận, mắt, thần kinh và bàn chân tăng lên. Mục tiêu của người đã có đái tháo đường có thể khác khoảng của người chưa mắc bệnh.', habits: 'Giữ bữa ăn đều; ưu tiên rau, thực phẩm giàu chất xơ và đạm nạc; hạn chế nước ngọt và đồ nhiều đường. Không tự đổi thuốc theo một kết quả.', source_url: 'https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/' },
  glucose: { plain_name: 'Lượng đường trong máu lúc lấy mẫu', explanation: 'Glucose là nguồn năng lượng chính. Xét nghiệm đo lượng đường tại thời điểm lấy máu; cần biết mẫu được lấy lúc đói hay sau ăn.', impact: 'Quá cao kéo dài có thể liên quan tiền đái tháo đường hoặc đái tháo đường; quá thấp có thể gây run, chóng mặt, lú lẫn và đôi khi là cấp cứu.', habits: 'Ưu tiên nước thay đồ uống có đường, ăn khẩu phần tinh bột vừa phải cùng rau và đạm. Nếu dùng thuốc hạ đường huyết, hỏi bác sĩ trước khi bỏ bữa hoặc đổi lượng vận động.', source_url: 'https://medlineplus.gov/lab-tests/blood-glucose-test/' },
  hemoglobin: { plain_name: 'Chất giúp máu mang oxy', explanation: 'Hemoglobin nằm trong hồng cầu và mang oxy từ phổi đến các cơ quan.', impact: 'Mức thấp có thể đi cùng mệt, yếu hoặc hụt hơi; mức cao hoặc thấp đều có nhiều nguyên nhân nên cần xem cùng công thức máu và triệu chứng.', habits: 'Nếu bác sĩ xác nhận thiếu sắt, thực phẩm giàu sắt kết hợp vitamin C có thể hỗ trợ. Không tự uống viên sắt nếu chưa biết nguyên nhân.', source_url: 'https://medlineplus.gov/lab-tests/hemoglobin-test/' },
  ferritin: { plain_name: 'Kho sắt dự trữ của cơ thể', explanation: 'Ferritin là protein giữ sắt. Xét nghiệm giúp ước lượng lượng sắt cơ thể đang dự trữ.', impact: 'Mức thấp thường gợi ý dự trữ sắt thấp; mức cao cũng có thể xuất hiện khi viêm hoặc trong các tình trạng khác, nên một mình ferritin không xác định nguyên nhân.', habits: 'Có thể ưu tiên thịt nạc, đậu, rau lá xanh đậm hoặc ngũ cốc tăng cường sắt và ăn cùng nguồn vitamin C. Viên sắt chỉ nên dùng theo hướng dẫn.', source_url: 'https://medlineplus.gov/lab-tests/ferritin-blood-test/' },
  ldl: { plain_name: 'Cholesterol có thể tích tụ trong mạch máu', explanation: 'LDL vận chuyển cholesterol trong máu. Mức mục tiêu tùy nguy cơ tim mạch của từng người.', impact: 'LDL cao lâu ngày góp phần tạo mảng bám trong động mạch, làm tăng nguy cơ bệnh tim và đột quỵ.', habits: 'Ưu tiên rau, đậu, ngũ cốc nguyên hạt, cá và các nguồn chất béo không bão hòa; hạn chế thịt nhiều mỡ, sữa nguyên kem và chất béo bão hòa.', source_url: 'https://medlineplus.gov/lab-tests/cholesterol-levels/' },
  creatinine: { plain_name: 'Chất thải giúp đánh giá khả năng lọc của thận', explanation: 'Creatinine sinh ra từ hoạt động của cơ và được thận lọc khỏi máu. Bác sĩ thường tính thêm eGFR để hiểu chức năng thận.', impact: 'Mức cao có thể xuất hiện khi thận lọc kém, nhưng cũng chịu ảnh hưởng bởi cơ bắp, mất nước, ăn thịt và một số thuốc; một kết quả không tự kết luận bệnh thận.', habits: 'Không tự tăng lượng nước, giảm đạm cực đoan hoặc dùng thực phẩm bổ sung chỉ vì một kết quả. Duy trì ăn cân bằng và làm theo kế hoạch riêng nếu bác sĩ xác nhận vấn đề về thận.', source_url: 'https://medlineplus.gov/lab-tests/creatinine-test/' },
};
