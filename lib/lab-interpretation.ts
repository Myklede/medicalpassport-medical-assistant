import type { Lab, Encounter, Medicine } from './portal-types.ts';

export function interpretLab(lab: Lab): { status: 'within' | 'high' | 'low' | 'unknown'; label: string; explanation: string; percent: number | null } {
  const raw = lab.value.trim();
  // Qualitative results and inequalities are never coerced to an exact number.
  const numeric = /^-?\d+(?:[.,]\d+)?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN;
  const low = lab.reference_low;
  const high = lab.reference_high;
  if (!lab.unit.trim() || !Number.isFinite(numeric) || (low === null && high === null) || (low !== null && !Number.isFinite(low)) || (high !== null && !Number.isFinite(high)) || (low !== null && high !== null && low > high)) {
    return { status: 'unknown', label: 'Not enough information to compare', explanation: 'This report does not include enough unit or reference-range information for a safe comparison. Review the original result and the clinician’s interpretation.', percent: null };
  }
  const percent = low !== null && high !== null && high > low ? Math.max(0, Math.min(100, 15 + ((numeric - low) / (high - low)) * 70)) : null;
  if (low !== null && numeric < low) return { status: 'low', label: 'Below the range on this report', explanation: 'The result is below the range this laboratory reports as typical. A low number alone does not show the cause; a clinician needs to review it with symptoms and other results.', percent };
  if (high !== null && numeric > high) return { status: 'high', label: 'Above the range on this report', explanation: 'The result is above the range this laboratory reports as typical. A high number alone is not enough to determine a condition or change medication.', percent };
  return { status: 'within', label: 'Within the range on this report', explanation: 'The result is within the range this laboratory reports as typical. This is often reassuring, but it still needs to be considered with symptoms and individual goals.', percent };
}

export function referenceLabel(lab: Lab): string {
  const low = lab.reference_low, high = lab.reference_high;
  if (low === null && high === null) return lab.reference_text || 'Not entered';
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
  hba1c: { plain_name: 'Average blood sugar over 2–3 months', explanation: 'HbA1c estimates average blood sugar over the past 2–3 months instead of at one moment.', impact: 'If it remains high, the risk of damage to the heart, kidneys, eyes, nerves, and feet increases. A person with diabetes may have a different goal from the reference range used for someone without diabetes.', habits: 'Eat regular meals; choose vegetables, high-fiber foods, and lean protein; limit sugary drinks and foods with added sugar. Do not change medication based on one result.', source_url: 'https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/' },
  glucose: { plain_name: 'Blood sugar at the time of the sample', explanation: 'Glucose is the body’s main source of energy. This test measures blood sugar when the sample is taken, so it matters whether the sample was fasting or after a meal.', impact: 'Levels that remain too high may be related to prediabetes or diabetes. A very low level can cause shaking, dizziness, confusion, and sometimes an emergency.', habits: 'Choose water instead of sugary drinks and eat moderate portions of carbohydrates with vegetables and protein. If you use glucose-lowering medicine, ask a clinician before skipping meals or changing activity levels.', source_url: 'https://medlineplus.gov/lab-tests/blood-glucose-test/' },
  hemoglobin: { plain_name: 'The protein that helps blood carry oxygen', explanation: 'Hemoglobin is found in red blood cells and carries oxygen from the lungs to the body’s organs.', impact: 'A low level may occur with tiredness, weakness, or shortness of breath. High and low results have many possible causes, so they should be reviewed with the full blood count and symptoms.', habits: 'If a clinician confirms iron deficiency, iron-rich foods paired with vitamin C may help. Do not start an iron supplement until the cause is known.', source_url: 'https://medlineplus.gov/lab-tests/hemoglobin-test/' },
  ferritin: { plain_name: 'The body’s stored iron', explanation: 'Ferritin is a protein that stores iron. The test helps estimate how much iron the body has in reserve.', impact: 'A low level often suggests low iron stores. A high level can also occur with inflammation or other conditions, so ferritin alone does not determine the cause.', habits: 'Choose lean meat, beans, dark leafy vegetables, or iron-fortified grains and pair them with a source of vitamin C. Use iron supplements only as directed.', source_url: 'https://medlineplus.gov/lab-tests/ferritin-blood-test/' },
  ldl: { plain_name: 'Cholesterol that can build up in blood vessels', explanation: 'LDL carries cholesterol in the blood. The target level depends on each person’s cardiovascular risk.', impact: 'LDL that stays high contributes to plaque in arteries and raises the risk of heart disease and stroke.', habits: 'Choose vegetables, beans, whole grains, fish, and unsaturated fats; limit fatty meats, full-fat dairy, and saturated fat.', source_url: 'https://medlineplus.gov/lab-tests/cholesterol-levels/' },
  creatinine: { plain_name: 'A waste product used to assess kidney filtration', explanation: 'Creatinine comes from muscle activity and is filtered from the blood by the kidneys. Clinicians often calculate eGFR as another measure of kidney function.', impact: 'A high level may occur when the kidneys filter less effectively, but it is also affected by muscle mass, dehydration, meat intake, and some medicines. One result alone does not establish kidney disease.', habits: 'Do not drastically increase water intake, restrict protein, or start supplements because of one result. Maintain a balanced diet and follow an individual plan if a clinician confirms a kidney concern.', source_url: 'https://medlineplus.gov/lab-tests/creatinine-test/' },
};
