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
  return value.trim().toLocaleLowerCase('en-US').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[–—]/g, '-').replace(/\s+/g, ' ');
}

const conditionEducation: EducationEntry[] = [
  {
    aliases: ['hen phe quan', 'asthma'],
    simple: 'The airways in the lungs can become inflamed and narrow, which may cause coughing, wheezing, chest tightness, or shortness of breath.',
    impact: 'Asthma can often be controlled. During a flare, the airways may narrow quickly; a severe attack can be dangerous if rescue medicine does not help or breathing remains very difficult.',
    target: 'There is no single normal number. The goal is few symptoms, normal sleep and activity, limited need for rescue medicine, and a clear asthma action plan.',
    habits: 'No food cures asthma. Avoid smoke and personal triggers such as dust, pollen, or cold air; use inhalers as directed and maintain balanced meals.',
    urgent: 'Call emergency services if breathing is very difficult or rescue medicine does not relieve symptoms.',
    sources: [
      { label: 'NHLBI · Asthma', url: 'https://www.nhlbi.nih.gov/health/asthma' },
      { label: 'NHLBI · Asthma attacks', url: 'https://www.nhlbi.nih.gov/health/asthma/attacks' },
    ],
  },
  {
    aliases: ['dai thao duong tip 2', 'type 2 diabetes mellitus', 'type 2 diabetes'],
    simple: 'The body does not use insulin effectively, so more sugar stays in the blood than the body needs.',
    impact: 'High blood sugar over time can affect the heart, kidneys, eyes, nerves, and feet. Managing blood sugar, blood pressure, and cholesterol helps lower these risks.',
    target: 'Blood glucose and HbA1c goals differ by person. Use the status shown on each lab card and the individual target confirmed by the clinician.',
    habits: 'A practical plate method is one-half non-starchy vegetables, one-quarter high-fiber foods such as whole grains or beans, and one-quarter lean protein. Choose water and limit sugary drinks, added sugar, saturated fat, and excess salt.',
    urgent: 'Very low blood sugar can be an emergency. Follow the hypoglycemia plan agreed upon with the clinician.',
    sources: [
      { label: 'NIDDK · Healthy living with diabetes', url: 'https://www.niddk.nih.gov/health-information/diabetes/overview/healthy-living-with-diabetes' },
      { label: 'NIDDK · Diabetes overview', url: 'https://www.niddk.nih.gov/health-information/diabetes/overview' },
    ],
  },
  {
    aliases: ['thieu mau thieu sat', 'iron deficiency anemia'],
    simple: 'The body does not have enough iron to make hemoglobin, the part of red blood cells that carries oxygen throughout the body.',
    impact: 'It may cause tiredness, weakness, or shortness of breath. If severe or persistent, anemia can make the heart work harder and may point to blood loss that needs evaluation.',
    target: 'The goal is for hemoglobin and ferritin to return to the appropriate laboratory range, for symptoms to improve, and for the cause of iron deficiency to be identified.',
    habits: 'Choose iron-rich foods such as lean meat, beans, dark leafy vegetables, or iron-fortified grains, and pair them with vitamin C to support absorption. Take iron supplements only as directed because too much iron can also be harmful.',
    sources: [
      { label: 'NHLBI · Anemia treatment', url: 'https://www.nhlbi.nih.gov/health/anemia/treatment' },
      { label: 'NHLBI · Causes of anemia', url: 'https://www.nhlbi.nih.gov/health/anemia/causes' },
    ],
  },
  {
    aliases: ['tang huyet ap', 'hypertension'],
    simple: 'The pressure of blood against artery walls stays higher than a healthy level.',
    impact: 'High blood pressure often causes no symptoms, but over time it can damage the heart, brain, kidneys, and eyes and raise the risk of heart attack or stroke.',
    target: 'A general reference for adults is below 120/80 mmHg. Diagnosis requires repeated measurements, and an individual treatment goal must be confirmed by a clinician.',
    habits: 'The DASH eating pattern emphasizes vegetables, fruit, whole grains, beans, fish, and low-fat dairy. Limit high-salt foods, fatty meats, saturated fat, sugary drinks, and alcohol, and stay active as appropriate for your abilities.',
    sources: [
      { label: 'CDC · About high blood pressure', url: 'https://www.cdc.gov/high-blood-pressure/about/' },
      { label: 'NHLBI · DASH eating plan', url: 'https://www.nhlbi.nih.gov/health/dash-eating-plan' },
    ],
  },
  {
    aliases: ['trao nguoc da day - thuc quan', 'gastroesophageal reflux disease (gerd)', 'gerd'],
    simple: 'Stomach contents regularly flow back into the tube between the mouth and stomach, which can cause heartburn or a sour taste.',
    impact: 'Most cases can be controlled. If reflux continues without care, the esophagus can become inflamed, ulcerated, narrowed, or bleed, making swallowing difficult.',
    target: 'The goal is little or no discomfort, normal sleep and eating, and no warning signs such as trouble swallowing or bleeding.',
    habits: 'If symptoms occur at night, finish eating at least three hours before lying down or sleeping. Track personal triggers; common ones include high-fat or spicy foods, coffee, chocolate, mint, alcohol, tomatoes, and citrus.',
    urgent: 'Contact a healthcare professional for trouble swallowing, vomiting blood, black stools, or unexplained chest pain.',
    sources: [
      { label: 'NIDDK · Definition and facts for GERD', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/acid-reflux-ger-gerd-adults/definition-facts' },
      { label: 'NIDDK · Eating, diet, and nutrition for GERD', url: 'https://www.niddk.nih.gov/health-information/digestive-diseases/acid-reflux-ger-gerd-adults/eating-diet-nutrition' },
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
