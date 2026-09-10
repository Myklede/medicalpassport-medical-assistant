export type PatientEducation = {
  simple: string;
  impact: string;
  target: string;
  habits: string;
  urgent?: string;
  sources: Array<{ label: string; url: string }>;
};

type EducationEntry = PatientEducation & { aliases: string[] };

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('vi-VN').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[–—]/g, '-').replace(/\s+/g, ' ');
}

const conditionEducation: EducationEntry[] = [
  {
    aliases: ['hen phe quan', 'asthma'],
    simple: 'Đường thở trong phổi có lúc bị viêm và hẹp lại, nên người bệnh có thể ho, khò khè, nặng ngực hoặc khó thở.',
    impact: 'Bệnh thường kiểm soát được. Khi bùng phát, đường thở có thể hẹp nhanh; cơn nặng có thể nguy hiểm nếu thuốc cắt cơn không giúp hoặc vẫn rất khó thở.',
    target: 'Không có một con số “bình thường” chung. Mục tiêu là ít triệu chứng, ngủ và vận động bình thường, ít phải dùng thuốc cắt cơn và có kế hoạch xử trí cơn hen.',
    habits: 'Không có món ăn nào chữa hen. Nên tránh khói thuốc và các tác nhân đã biết của riêng mình như bụi, phấn hoa, không khí lạnh; dùng dụng cụ hít đúng hướng dẫn và duy trì bữa ăn cân bằng.',
    urgent: 'Nếu rất khó thở hoặc thuốc cắt cơn không làm đỡ triệu chứng, cần gọi cấp cứu.',
    sources: [
      { label: 'NHLBI · Hen phế quản', url: 'https://www.nhlbi.nih.gov/health/asthma' },
      { label: 'NHLBI · Cơn hen', url: 'https://www.nhlbi.nih.gov/health/asthma/attacks' },
    ],
  },
  {
    aliases: ['dai thao duong tip 2', 'type 2 diabetes mellitus', 'type 2 diabetes'],
    simple: 'Cơ thể sử dụng insulin chưa hiệu quả, làm đường tích lại trong máu nhiều hơn mức cơ thể cần.',
    impact: 'Đường huyết cao kéo dài có thể ảnh hưởng tim, thận, mắt, thần kinh và bàn chân. Kiểm soát đường huyết, huyết áp và cholesterol giúp giảm nguy cơ này.',
    target: 'Mục tiêu đường huyết và HbA1c khác nhau theo từng người. Hãy xem trạng thái ngay trên từng thẻ xét nghiệm và dùng mục tiêu do bác sĩ xác nhận.',
    habits: 'Có thể dùng cách chia đĩa: 1/2 rau không nhiều tinh bột, 1/4 thực phẩm giàu chất xơ như ngũ cốc nguyên hạt hoặc đậu, 1/4 đạm nạc. Ưu tiên nước và hạn chế nước ngọt, đồ nhiều đường, chất béo bão hòa và muối.',
    urgent: 'Đường huyết quá thấp có thể là cấp cứu. Làm theo kế hoạch xử trí hạ đường huyết đã thống nhất với bác sĩ.',
    sources: [
      { label: 'NIDDK · Sống khỏe với đái tháo đường', url: 'https://www.niddk.nih.gov/health-information/diabetes/overview/healthy-living-with-diabetes' },
      { label: 'NIDDK · Tổng quan đái tháo đường', url: 'https://www.niddk.nih.gov/health-information/diabetes/overview' },
    ],
  },
  {
    aliases: ['thieu mau thieu sat', 'iron deficiency anemia'],
    simple: 'Cơ thể thiếu sắt để tạo đủ hemoglobin, là phần của hồng cầu mang oxy đi nuôi cơ thể.',
    impact: 'Có thể gây mệt, yếu hoặc hụt hơi. Nếu kéo dài hoặc nặng, thiếu máu có thể làm tim phải hoạt động nhiều hơn và cũng có thể là dấu hiệu mất máu cần tìm nguyên nhân.',
    target: 'Mục tiêu là hemoglobin và ferritin trở lại khoảng phòng xét nghiệm phù hợp, triệu chứng cải thiện và nguyên nhân thiếu sắt được xác định.',
    habits: 'Ưu tiên thực phẩm giàu sắt như thịt nạc, đậu, rau lá xanh đậm hoặc ngũ cốc tăng cường sắt; ăn cùng thực phẩm giàu vitamin C để hỗ trợ hấp thu. Chỉ dùng viên sắt theo hướng dẫn vì thừa sắt cũng có thể gây hại.',
    sources: [
      { label: 'NHLBI · Điều trị thiếu máu', url: 'https://www.nhlbi.nih.gov/health/anemia/treatment' },
      { label: 'NHLBI · Nguyên nhân thiếu máu', url: 'https://www.nhlbi.nih.gov/health/anemia/causes' },
    ],
  },
  {
    aliases: ['tang huyet ap', 'hypertension'],
    simple: 'Áp lực của máu lên thành mạch thường xuyên cao hơn mức khỏe mạnh.',
    impact: 'Bệnh thường không gây triệu chứng nhưng có thể âm thầm làm tổn thương tim, não, thận và mắt, làm tăng nguy cơ đau tim hoặc đột quỵ.',
    target: 'Mức tham khảo chung cho người lớn là dưới 120/80 mmHg. Chẩn đoán cần nhiều lần đo và mục tiêu điều trị cá nhân phải do bác sĩ xác nhận.',
    habits: 'Kiểu ăn DASH ưu tiên rau, trái cây, ngũ cốc nguyên hạt, đậu, cá và sữa ít béo. Hạn chế thực phẩm nhiều muối, thịt nhiều mỡ, chất béo bão hòa, nước ngọt và rượu; duy trì vận động theo khả năng.',
    sources: [
      { label: 'CDC · Hiểu về huyết áp cao', url: 'https://www.cdc.gov/high-blood-pressure/about/' },
      { label: 'NHLBI · Chế độ ăn DASH', url: 'https://www.nhlbi.nih.gov/health/dash-eating-plan' },
    ],
  },
  {
    aliases: ['trao nguoc da day - thuc quan', 'gastroesophageal reflux disease (gerd)', 'gerd'],
    simple: 'Dịch hoặc thức ăn trong dạ dày thường xuyên trào ngược lên ống nối miệng với dạ dày, gây ợ nóng hoặc trớ chua.',
    impact: 'Phần lớn có thể kiểm soát. Nếu kéo dài mà không được xử lý, thực quản có thể bị viêm, loét, chảy máu hoặc hẹp gây khó nuốt.',
    target: 'Mục tiêu là triệu chứng ít hoặc hết, không làm gián đoạn ngủ và ăn uống, đồng thời không có dấu hiệu như khó nuốt hoặc chảy máu.',
    habits: 'Nếu hay khó chịu ban đêm, nên ăn trước khi nằm hoặc ngủ ít nhất 3 giờ. Theo dõi món gây triệu chứng riêng; các tác nhân thường gặp gồm đồ nhiều béo, cay, cà phê, chocolate, bạc hà, rượu, cà chua hoặc cam chanh.',
    urgent: 'Cần liên hệ cơ sở y tế nếu khó nuốt, nôn ra máu, đi ngoài phân đen hoặc đau ngực chưa rõ nguyên nhân.',
    sources: [
      { label: 'NIDDK · GERD là gì', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/acid-reflux-ger-gerd-adults/definition-facts' },
      { label: 'NIDDK · Ăn uống khi có GERD', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/acid-reflux-ger-gerd-adults/eating-diet-nutrition' },
    ],
  },
];

export function educationForCondition(...names: string[]): PatientEducation | undefined {
  const candidates = names.filter(Boolean).map(normalize);
  const match = conditionEducation.find(entry => entry.aliases.some(alias => candidates.includes(alias)));
  if (!match) return undefined;
  const { aliases: _aliases, ...education } = match;
  return education;
}
