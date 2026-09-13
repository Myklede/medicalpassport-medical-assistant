import { Apple, BookOpen, CircleGauge, HeartPulse, TriangleAlert } from 'lucide-react';
import type { PatientEducation as Education } from '@/lib/patient-education';

export function PatientEducation({ education, defaultOpen = false }: { education: Education; defaultOpen?: boolean }) {
  return <div className="mp-education">
    <div className="mp-education-simple"><BookOpen /><div><b>IN PLAIN LANGUAGE</b><p>{education.simple}</p></div></div>
    <details open={defaultOpen}>
      <summary>Understand the effects, goals, and daily habits</summary>
      <div className="mp-education-grid">
        <div><b><HeartPulse />How can it affect you?</b><p>{education.impact}</p></div>
        <div><b><CircleGauge />Monitoring goal</b><p>{education.target}</p></div>
        <div className="wide"><b><Apple />Food & daily habits</b><p>{education.habits}</p></div>
        {education.urgent && <div className="wide alert"><b><TriangleAlert />When should you get help now?</b><p>{education.urgent}</p></div>}
      </div>
      <div className="mp-education-sources">Sources: {education.sources.map((source, index) => <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noreferrer">{source.label} ↗</a></span>)}</div>
      <p className="mp-education-note">General information to make the record easier to understand. It does not replace individual clinical guidance and should not be used to change medication on your own.</p>
    </details>
  </div>;
}
