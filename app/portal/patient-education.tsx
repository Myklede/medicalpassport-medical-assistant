import { Apple, BookOpen, CircleGauge, HeartPulse, TriangleAlert } from 'lucide-react';
import type { PatientEducation as Education } from '@/lib/patient-education';

export function PatientEducation({ education, defaultOpen = false }: { education: Education; defaultOpen?: boolean }) {
  return <div className="mp-education">
    <div className="mp-education-simple"><BookOpen /><div><b>NÓI ĐƠN GIẢN</b><p>{education.simple}</p></div></div>
    <details open={defaultOpen}>
      <summary>Hiểu thêm về ảnh hưởng, mục tiêu và ăn uống</summary>
      <div className="mp-education-grid">
        <div><b><HeartPulse />Có thể ảnh hưởng thế nào?</b><p>{education.impact}</p></div>
        <div><b><CircleGauge />Mục tiêu theo dõi</b><p>{education.target}</p></div>
        <div className="wide"><b><Apple />Ăn uống & sinh hoạt</b><p>{education.habits}</p></div>
        {education.urgent && <div className="wide alert"><b><TriangleAlert />Khi nào cần chú ý ngay?</b><p>{education.urgent}</p></div>}
      </div>
      <div className="mp-education-sources">Nguồn tham khảo: {education.sources.map((source, index) => <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></span>)}</div>
      <p className="mp-education-note">Thông tin chung để dễ hiểu hồ sơ; không thay thế hướng dẫn riêng và không dùng để tự đổi thuốc.</p>
    </details>
  </div>;
}
