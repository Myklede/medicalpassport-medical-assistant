export type CountryCode = 'VN' | 'IN' | 'US' | 'CN';
export type AccessClass = 'otc' | 'rx' | 'verify';

export type CountryMedication = {
  exampleName: string;
  localIngredient: string;
  strength: string;
  form: string;
  access: AccessClass;
  accessNote: string;
};

export type MedicationExchange = {
  id: string;
  inn: string;
  atc: string;
  purpose: string;
  safetyNote: string;
  excipientWatch: string;
  pharmacistChecks: string[];
  products: Record<CountryCode, CountryMedication>;
};

export const COUNTRIES: Record<
  CountryCode,
  {
    name: string;
    flag: string;
    regulator: string;
    registryUrl: string;
    accessContext: string;
  }
> = {
  VN: {
    name: 'Vietnam',
    flag: '🇻🇳',
    regulator: 'Drug Administration of Vietnam — Ministry of Health',
    registryUrl: 'https://dichvucong.dav.gov.vn/congbothuockhongkedon',
    accessContext:
      'Verify the exact registration number, strength, dosage form, and prescription/nonprescription label for the marketed product.',
  },
  IN: {
    name: 'India',
    flag: '🇮🇳',
    regulator: 'CDSCO',
    registryUrl: 'https://cdsco.gov.in/opencms/opencms/en/Acts-Rules/',
    accessContext:
      'India does not have one statutory OTC list. OTC* in this demo means the sample dataset does not mark the product as Rx. Ask a pharmacist and check Schedule H/H1/X on the label.',
  },
  US: {
    name: 'United States',
    flag: '🇺🇸',
    regulator: 'U.S. FDA',
    registryUrl: 'https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm',
    accessContext:
      'Rx/OTC status applies to the exact product, strength, and dosage form recognized by the FDA; one active ingredient may have both Rx and OTC products.',
  },
  CN: {
    name: 'China',
    flag: '🇨🇳',
    regulator: 'NMPA',
    registryUrl: 'https://zwfw.nmpa.gov.cn/web/taskdir/one',
    accessContext:
      'Classification is product-specific. Verify the OTC/Rx label, approval number, and current Chinese-language instructions.',
  },
};

const p = (
  exampleName: string,
  localIngredient: string,
  strength: string,
  form: string,
  access: AccessClass,
  accessNote: string,
): CountryMedication => ({
  exampleName,
  localIngredient,
  strength,
  form,
  access,
  accessNote,
});

const vnOtc =
  'Nonprescription demo example; verify the exact product label and Drug Administration of Vietnam record.';
const indiaOtc =
  'OTC* in this demo; India does not have one statutory OTC list. Check the label and ask a pharmacist.';
const usOtc =
  'Nonprescription for the exact strength and dosage form shown; read the Drug Facts label before use.';
const chinaOtc =
  'OTC demo example; verify the OTC mark and directions for the exact product.';
const rx =
  'Requires a prescription and prescriber review; do not use an old prescription to purchase it in another country.';
const verify =
  'Classification may differ by product, strength, or sales channel; a pharmacist must verify it before purchase.';

export const MEDICATION_EXCHANGES: MedicationExchange[] = [
  {
    id: 'paracetamol',
    inn: 'Paracetamol (acetaminophen)',
    atc: 'N02BE01',
    purpose: 'Pain and fever relief',
    safetyNote:
      'Overdose or combining multiple cold products with the same active ingredient can cause serious liver injury.',
    excipientWatch:
      'Effervescent, syrup, chewable, and capsule products may differ in sodium, sugar or sweeteners, colors, flavors, or gelatin.',
    pharmacistChecks: [
      'Total paracetamol/acetaminophen dose from every product',
      'Liver disease or regular alcohol use',
      'Combination cold products containing APAP/paracetamol',
    ],
    products: {
      VN: p(
        'Panadol 500 mg',
        'Paracetamol',
        '500 mg',
        'Immediate-release tablet',
        'otc',
        vnOtc,
      ),
      IN: p(
        'Crocin 500',
        'Paracetamol',
        '500 mg',
        'Immediate-release tablet',
        'otc',
        indiaOtc,
      ),
      US: p(
        'Tylenol Extra Strength',
        'Acetaminophen',
        '500 mg',
        'Immediate-release tablet/caplet',
        'otc',
        usOtc,
      ),
      CN: p(
        '必理通 Panadol',
        '对乙酰氨基酚',
        '500 mg',
        'Immediate-release tablet',
        'otc',
        chinaOtc,
      ),
    },
  },
  {
    id: 'ibuprofen',
    inn: 'Ibuprofen',
    atc: 'M01AE01',
    purpose: 'Pain, fever, and inflammation relief',
    safetyNote:
      'It can cause gastrointestinal bleeding, kidney injury, and increased cardiovascular risk; risk rises with higher doses or longer use.',
    excipientWatch:
      'Softgels often contain gelatin; suspensions may differ in colors, flavors, sugar, or other sweeteners.',
    pharmacistChecks: [
      'History of stomach ulcer or bleeding',
      'Kidney or cardiovascular disease, or anticoagulant use',
      'Pregnancy, especially from week 20 onward',
    ],
    products: {
      VN: p(
        'Nurofen 200 mg',
        'Ibuprofen',
        '200 mg',
        'Immediate-release tablet',
        'otc',
        vnOtc,
      ),
      IN: p(
        'Brufen 200',
        'Ibuprofen',
        '200 mg',
        'Immediate-release tablet',
        'otc',
        indiaOtc,
      ),
      US: p(
        'Advil 200 mg',
        'Ibuprofen',
        '200 mg',
        'Immediate-release tablet',
        'otc',
        usOtc,
      ),
      CN: p(
        '布洛芬片',
        '布洛芬',
        '200 mg',
        'Immediate-release tablet',
        'otc',
        chinaOtc,
      ),
    },
  },
  {
    id: 'cetirizine',
    inn: 'Cetirizine',
    atc: 'R06AE07',
    purpose: 'Allergy symptom relief',
    safetyNote:
      'It may cause drowsiness or reduced alertness; alcohol and sedating medicines can intensify this effect.',
    excipientWatch:
      'Liquids and chewable tablets may differ in flavor, color, lactose, sucrose, or sweeteners.',
    pharmacistChecks: [
      'Drowsiness while driving or operating machinery',
      'Kidney disease that may require dose review',
      'Single-ingredient cetirizine rather than a combination cold product',
    ],
    products: {
      VN: p(
        'Zyrtec 10 mg',
        'Cetirizine dihydrochloride',
        '10 mg',
        'Film-coated tablet',
        'otc',
        vnOtc,
      ),
      IN: p(
        'Cetzine 10 mg',
        'Cetirizine hydrochloride',
        '10 mg',
        'Film-coated tablet',
        'verify',
        verify,
      ),
      US: p(
        'Zyrtec 10 mg',
        'Cetirizine hydrochloride',
        '10 mg',
        'Tablet',
        'otc',
        usOtc,
      ),
      CN: p(
        '仙特明 Zyrtec',
        '盐酸西替利嗪',
        '10 mg',
        'Tablet',
        'otc',
        chinaOtc,
      ),
    },
  },
  {
    id: 'loratadine',
    inn: 'Loratadine',
    atc: 'R06AX13',
    purpose: 'Relief of allergic rhinitis and hives',
    safetyNote:
      'Headache, dry mouth, or drowsiness can still occur, although it is often less sedating than some other allergy medicines.',
    excipientWatch:
      'Rapidly disintegrating tablets may contain aspartame; syrups and tablets may differ in sugar, color, flavor, or lactose.',
    pharmacistChecks: [
      'Severe liver disease',
      'Rapidly disintegrating forms in phenylketonuria',
      'Avoid duplication with combination allergy products',
    ],
    products: {
      VN: p('Clarityne 10 mg', 'Loratadine', '10 mg', 'Tablet', 'otc', vnOtc),
      IN: p(
        'Lorfast 10 mg',
        'Loratadine',
        '10 mg',
        'Tablet',
        'otc',
        indiaOtc,
      ),
      US: p('Claritin 10 mg', 'Loratadine', '10 mg', 'Tablet', 'otc', usOtc),
      CN: p(
        '开瑞坦 Claritin',
        '氯雷他定',
        '10 mg',
        'Tablet',
        'otc',
        chinaOtc,
      ),
    },
  },
  {
    id: 'omeprazole',
    inn: 'Omeprazole',
    atc: 'A02BC01',
    purpose: 'Reduction of stomach acid',
    safetyNote:
      'Do not continue it long term based only on a product name. Persistent symptoms, trouble swallowing, bleeding, or weight loss need medical evaluation.',
    excipientWatch:
      'Enteric-coated granules and capsule shells have specific excipients and release mechanisms; do not crush or change dosage form independently.',
    pharmacistChecks: [
      'Duration and reason for use',
      'Interactions, including some antiplatelet medicines',
      'Correct delayed-release or enteric-coated form',
    ],
    products: {
      VN: p(
        'Losec MUPS 20 mg',
        'Omeprazole',
        '20 mg',
        'Enteric-coated tablet',
        'verify',
        verify,
      ),
      IN: p(
        'Omez 20 mg',
        'Omeprazole',
        '20 mg',
        'Delayed-release capsule',
        'rx',
        rx,
      ),
      US: p(
        'Prilosec OTC 20 mg',
        'Omeprazole magnesium',
        '20 mg',
        'Delayed-release tablet, OTC course',
        'otc',
        usOtc,
      ),
      CN: p(
        '洛赛克 Losec 20 mg',
        '奥美拉唑',
        '20 mg',
        'Enteric-coated tablet',
        'verify',
        verify,
      ),
    },
  },
  {
    id: 'famotidine',
    inn: 'Famotidine',
    atc: 'A02BA03',
    purpose: 'Reduction of stomach acid and heartburn',
    safetyNote:
      'It may cause headache, dizziness, or constipation; people with reduced kidney function may need dose adjustment.',
    excipientWatch:
      'Chewable tablets and suspensions may contain calcium or magnesium, flavors, colors, sucrose, or other sweeteners.',
    pharmacistChecks: [
      'Kidney function',
      'Persistent or recurring symptoms',
      'Single-ingredient product or combination with an antacid',
    ],
    products: {
      VN: p(
        'Famotidine 20 mg',
        'Famotidine',
        '20 mg',
        'Film-coated tablet',
        'verify',
        verify,
      ),
      IN: p('Famocid 20', 'Famotidine', '20 mg', 'Tablet', 'rx', rx),
      US: p('Pepcid AC 20 mg', 'Famotidine', '20 mg', 'Tablet', 'otc', usOtc),
      CN: p('法莫替丁片', '法莫替丁', '20 mg', 'Tablet', 'verify', verify),
    },
  },
  {
    id: 'loperamide',
    inn: 'Loperamide',
    atc: 'A07DA03',
    purpose: 'Short-term diarrhea relief',
    safetyNote:
      'Overdose can cause dangerous heart-rhythm problems. Diarrhea with high fever or blood in the stool needs medical evaluation.',
    excipientWatch:
      'Dissolving tablets and liquids may differ in aspartame, colors, flavors, alcohol, or sugar.',
    pharmacistChecks: [
      'Fever, bloody or black stool, or abdominal distension',
      'Patient age and duration of diarrhea',
      'Do not exceed the labeled dose',
    ],
    products: {
      VN: p(
        'Imodium 2 mg',
        'Loperamide hydrochloride',
        '2 mg',
        'Capsule',
        'otc',
        vnOtc,
      ),
      IN: p(
        'Eldoper 2 mg',
        'Loperamide hydrochloride',
        '2 mg',
        'Capsule',
        'otc',
        indiaOtc,
      ),
      US: p(
        'Imodium A-D 2 mg',
        'Loperamide hydrochloride',
        '2 mg',
        'Softgel/caplet',
        'otc',
        usOtc,
      ),
      CN: p(
        '易蒙停 Imodium',
        '盐酸洛哌丁胺',
        '2 mg',
        'Capsule',
        'otc',
        chinaOtc,
      ),
    },
  },
  {
    id: 'dextromethorphan',
    inn: 'Dextromethorphan',
    atc: 'R05DA09',
    purpose: 'Dry-cough relief',
    safetyNote:
      'It may cause drowsiness. Combining it with an MAOI or some serotonin-raising medicines can be dangerous. Excessive use carries poisoning and misuse risks.',
    excipientWatch:
      'Syrups may differ in alcohol, sugar, sorbitol, colors, and flavors. Combination cold products may add paracetamol or an antihistamine.',
    pharmacistChecks: [
      'Single-ingredient or combination cold product',
      'Current antidepressant or MAOI use',
      'In China, single-ingredient oral products are prescription-only and tightly controlled',
    ],
    products: {
      VN: p(
        'Dextromethorphan HBr',
        'Dextromethorphan hydrobromide',
        '15 mg/5 mL',
        'Single-ingredient oral syrup',
        'otc',
        vnOtc,
      ),
      IN: p(
        'Dextromethorphan HBr syrup',
        'Dextromethorphan hydrobromide',
        '15 mg/5 mL',
        'Single-ingredient oral syrup',
        'verify',
        verify,
      ),
      US: p(
        'Delsym',
        'Dextromethorphan polistirex',
        '30 mg/5 mL',
        'Extended-release suspension',
        'otc',
        usOtc,
      ),
      CN: p(
        '右美沙芬口服单方制剂',
        '右美沙芬',
        'Prescription strength',
        'Single-ingredient oral product',
        'rx',
        'Single-ingredient oral products have moved to prescription status; verify current controlled-product requirements.',
      ),
    },
  },
  {
    id: 'clotrimazole',
    inn: 'Clotrimazole',
    atc: 'D01AC01',
    purpose: 'Topical treatment of fungal skin infections',
    safetyNote:
      'It may cause local burning, redness, or irritation. Do not use a skin cream in the eyes, mouth, or vagina.',
    excipientWatch:
      'Cream bases may differ in benzyl alcohol, cetyl or stearyl alcohol, propylene glycol, or preservatives.',
    pharmacistChecks: [
      'Correct application site and dosage form',
      'Large broken-skin area, infection, or symptoms that do not improve',
      'History of allergy to cream bases or preservatives',
    ],
    products: {
      VN: p('Canesten 1%', 'Clotrimazole', '1%', 'Topical cream', 'otc', vnOtc),
      IN: p('Candid 1%', 'Clotrimazole', '1%', 'Topical cream', 'otc', indiaOtc),
      US: p('Lotrimin AF 1%', 'Clotrimazole', '1%', 'Topical cream', 'otc', usOtc),
      CN: p('克霉唑乳膏 1%', '克霉唑', '1%', 'Topical cream', 'otc', chinaOtc),
    },
  },
  {
    id: 'hydrocortisone',
    inn: 'Hydrocortisone (topical)',
    atc: 'D07AA02',
    purpose: 'Relief of mild itching and skin inflammation',
    safetyNote:
      'Overuse may thin the skin or hide an infection; application site and duration should be limited.',
    excipientWatch:
      'Cream, ointment, and lotion bases differ substantially. Lanolin, propylene glycol, parabens, or fatty alcohols may irritate some people.',
    pharmacistChecks: [
      'Signs of infection, fungus, or an open wound',
      'Use on the face, genital area, or a young child',
      'Correct 1% strength and cream or ointment base',
    ],
    products: {
      VN: p(
        'Hydrocortisone 1%',
        'Hydrocortisone',
        '1%',
        'Topical cream',
        'verify',
        verify,
      ),
      IN: p(
        'Hydrocortisone 1%',
        'Hydrocortisone',
        '1%',
        'Topical cream',
        'rx',
        rx,
      ),
      US: p('Cortizone-10', 'Hydrocortisone', '1%', 'Topical cream', 'otc', usOtc),
      CN: p(
        '氢化可的松乳膏 1%',
        '氢化可的松',
        '1%',
        'Topical cream',
        'verify',
        verify,
      ),
    },
  },
  {
    id: 'amoxicillin',
    inn: 'Amoxicillin',
    atc: 'J01CA04',
    purpose: 'Penicillin antibiotic for an appropriate bacterial infection',
    safetyNote:
      'It can cause a serious allergic reaction and diarrhea. It does not treat viruses, and leftover medicine from an old prescription should not be used.',
    excipientWatch:
      'Suspension powders, capsule shells, and flavors differ. Anyone with a penicillin or cephalosporin allergy needs review first.',
    pharmacistChecks: [
      'Penicillin or cephalosporin allergy',
      'Indication, dose, interval, and full treatment duration',
      'Kidney function and medication interactions',
    ],
    products: {
      VN: p(
        'Amoxil 500 mg',
        'Amoxicillin trihydrate',
        '500 mg',
        'Capsule',
        'rx',
        rx,
      ),
      IN: p(
        'Novamox 500',
        'Amoxicillin trihydrate',
        '500 mg',
        'Capsule',
        'rx',
        rx,
      ),
      US: p(
        'Amoxicillin 500 mg',
        'Amoxicillin',
        '500 mg',
        'Capsule',
        'rx',
        rx,
      ),
      CN: p('阿莫仙 500 mg', '阿莫西林', '500 mg', 'Capsule', 'rx', rx),
    },
  },
  {
    id: 'azithromycin',
    inn: 'Azithromycin',
    atc: 'J01FA10',
    purpose: 'Macrolide antibiotic for an appropriate bacterial infection',
    safetyNote:
      'It may cause diarrhea and QT prolongation or rhythm problems in at-risk patients. Do not use it to self-treat a cold or flu.',
    excipientWatch:
      'Tablets and suspensions differ in colors, flavors, sucrose, or film coating. The 250 mg and 500 mg strengths are not interchangeable without dose review.',
    pharmacistChecks: [
      'Reason for prescribing and correct regimen',
      'History of long QT or arrhythmia and interacting medicines',
      'Liver disease and signs of allergy',
    ],
    products: {
      VN: p(
        'Zithromax 500 mg',
        'Azithromycin dihydrate',
        '500 mg',
        'Film-coated tablet',
        'rx',
        rx,
      ),
      IN: p('Azee 500', 'Azithromycin', '500 mg', 'Tablet', 'rx', rx),
      US: p('Zithromax 500 mg', 'Azithromycin', '500 mg', 'Tablet', 'rx', rx),
      CN: p('希舒美 500 mg', '阿奇霉素', '500 mg', 'Tablet', 'rx', rx),
    },
  },
  {
    id: 'metformin',
    inn: 'Metformin',
    atc: 'A10BA02',
    purpose: 'Prescription treatment for type 2 diabetes',
    safetyNote:
      'Gastrointestinal discomfort is common. The rare but serious risk of lactic acidosis rises with kidney impairment or some acute conditions.',
    excipientWatch:
      'Immediate-release and extended-release tablets are not directly equivalent; coatings, colors, and excipients may differ.',
    pharmacistChecks: [
      'IR or XR/ER formulation and dosing time',
      'Kidney function, acute illness, or dehydration',
      'Plan around procedures using contrast material, if applicable',
    ],
    products: {
      VN: p(
        'Glucophage 500 mg',
        'Metformin hydrochloride',
        '500 mg',
        'Immediate-release tablet',
        'rx',
        rx,
      ),
      IN: p(
        'Glycomet 500',
        'Metformin hydrochloride',
        '500 mg',
        'Immediate-release tablet',
        'rx',
        rx,
      ),
      US: p(
        'Metformin 500 mg',
        'Metformin hydrochloride',
        '500 mg',
        'Immediate-release tablet',
        'rx',
        rx,
      ),
      CN: p(
        '格华止 500 mg',
        '盐酸二甲双胍',
        '500 mg',
        'Immediate-release tablet',
        'rx',
        rx,
      ),
    },
  },
  {
    id: 'amlodipine',
    inn: 'Amlodipine',
    atc: 'C08CA01',
    purpose: 'Prescription treatment for hypertension or angina',
    safetyNote:
      'It may cause ankle swelling, flushing, dizziness, or palpitations. Do not stop blood-pressure medicine on your own while traveling.',
    excipientWatch:
      'The salt is often amlodipine besylate, while labels may express strength as amlodipine base; tablet excipients vary by manufacturer.',
    pharmacistChecks: [
      'Strength expressed as amlodipine base',
      'Swelling, dizziness, and current blood pressure',
      'Adequate supply and follow-up plan',
    ],
    products: {
      VN: p(
        'Norvasc 5 mg',
        'Amlodipine besylate',
        'Equivalent to 5 mg amlodipine',
        'Tablet',
        'rx',
        rx,
      ),
      IN: p(
        'Amlong 5',
        'Amlodipine besylate',
        'Equivalent to 5 mg amlodipine',
        'Tablet',
        'rx',
        rx,
      ),
      US: p(
        'Norvasc 5 mg',
        'Amlodipine besylate',
        'Equivalent to 5 mg amlodipine',
        'Tablet',
        'rx',
        rx,
      ),
      CN: p(
        '络活喜 5 mg',
        '苯磺酸氨氯地平',
        'Equivalent to 5 mg amlodipine',
        'Tablet',
        'rx',
        rx,
      ),
    },
  },
  {
    id: 'losartan',
    inn: 'Losartan',
    atc: 'C09CA01',
    purpose: 'Prescription treatment for hypertension or kidney protection',
    safetyNote:
      'It may increase potassium or affect kidney function. It is contraindicated during pregnancy because it can harm the fetus.',
    excipientWatch:
      'Film-coating colors, lactose, and potassium-salt labeling can differ. A product combined with hydrochlorothiazide is a different medicine.',
    pharmacistChecks: [
      'Whether this is single-ingredient losartan',
      'Pregnancy or pregnancy plans',
      'Potassium, kidney function, and current medicines',
    ],
    products: {
      VN: p(
        'Cozaar 50 mg',
        'Losartan potassium',
        '50 mg',
        'Film-coated tablet',
        'rx',
        rx,
      ),
      IN: p('Losacar 50', 'Losartan potassium', '50 mg', 'Tablet', 'rx', rx),
      US: p(
        'Cozaar 50 mg',
        'Losartan potassium',
        '50 mg',
        'Tablet',
        'rx',
        rx,
      ),
      CN: p('科素亚 50 mg', '氯沙坦钾', '50 mg', 'Film-coated tablet', 'rx', rx),
    },
  },
  {
    id: 'atorvastatin',
    inn: 'Atorvastatin',
    atc: 'C10AA05',
    purpose: 'Prescription reduction of cholesterol and cardiovascular risk',
    safetyNote:
      'Unusual muscle pain or weakness, or dark urine, needs evaluation. Some medicines and grapefruit can increase exposure.',
    excipientWatch:
      'Atorvastatin-calcium labeling and excipients such as lactose or film-coating colors can vary by manufacturer.',
    pharmacistChecks: [
      'Correct strength and single active ingredient',
      'Muscle pain, liver disease, and medicine interactions',
      'Pregnancy or breastfeeding according to prescriber guidance',
    ],
    products: {
      VN: p(
        'Lipitor 20 mg',
        'Atorvastatin calcium',
        'Equivalent to 20 mg atorvastatin',
        'Film-coated tablet',
        'rx',
        rx,
      ),
      IN: p(
        'Atorva 20',
        'Atorvastatin calcium',
        'Equivalent to 20 mg atorvastatin',
        'Tablet',
        'rx',
        rx,
      ),
      US: p(
        'Lipitor 20 mg',
        'Atorvastatin calcium',
        'Equivalent to 20 mg atorvastatin',
        'Tablet',
        'rx',
        rx,
      ),
      CN: p(
        '立普妥 20 mg',
        '阿托伐他汀钙',
        'Equivalent to 20 mg atorvastatin',
        'Film-coated tablet',
        'rx',
        rx,
      ),
    },
  },
  {
    id: 'levothyroxine',
    inn: 'Levothyroxine sodium',
    atc: 'H03AA01',
    purpose: 'Prescription thyroid-hormone replacement',
    safetyNote:
      'It has a narrow dosing range that needs close monitoring. Switching products may require TSH and symptom review; do not change the dose independently.',
    excipientWatch:
      'Strength-specific colors, lactose, acacia, and other excipients may vary by brand. Timing with food and minerals is important.',
    pharmacistChecks: [
      'Correct microgram dose — do not confuse it with mg',
      'Keep the same product when possible',
      'Spacing from calcium or iron and timing of TSH testing',
    ],
    products: {
      VN: p(
        'Euthyrox 50 microgram',
        'Levothyroxine sodium',
        '50 microgram',
        'Tablet',
        'rx',
        rx,
      ),
      IN: p(
        'Thyronorm 50 microgram',
        'Thyroxine sodium',
        '50 microgram',
        'Tablet',
        'rx',
        rx,
      ),
      US: p(
        'Synthroid 50 microgram',
        'Levothyroxine sodium',
        '50 microgram',
        'Tablet',
        'rx',
        rx,
      ),
      CN: p(
        '优甲乐 50 microgram',
        '左甲状腺素钠',
        '50 microgram',
        'Tablet',
        'rx',
        rx,
      ),
    },
  },
  {
    id: 'salbutamol',
    inn: 'Salbutamol (albuterol)',
    atc: 'R03AC02',
    purpose: 'Prescription inhaled bronchodilator',
    safetyNote:
      'It may cause tremor, rapid heart rate, or low potassium. Urgent assessment is needed if breathing difficulty does not respond as expected in the care plan.',
    excipientWatch:
      'An inhaler is a drug-device product: propellant, valve, actuation count, spacer, and technique can differ.',
    pharmacistChecks: [
      'Whether the label states metered or delivered dose',
      'Device and inhaler/spacer technique',
      'Rescue-use frequency and asthma action plan',
    ],
    products: {
      VN: p(
        'Ventolin Evohaler',
        'Salbutamol sulfate',
        '100 micrograms/actuation',
        'Metered-dose inhaler',
        'rx',
        rx,
      ),
      IN: p(
        'Asthalin inhaler',
        'Salbutamol sulfate',
        '100 micrograms/actuation',
        'Metered-dose inhaler',
        'rx',
        rx,
      ),
      US: p(
        'Ventolin HFA',
        'Albuterol sulfate',
        '90 micrograms delivered/actuation',
        'Metered-dose inhaler',
        'rx',
        rx,
      ),
      CN: p(
        '万托林 Ventolin',
        '硫酸沙丁胺醇',
        '100 micrograms/actuation',
        'Metered-dose inhaler',
        'rx',
        rx,
      ),
    },
  },
  {
    id: 'insulin-glargine',
    inn: 'Insulin glargine',
    atc: 'A10AE04',
    purpose: 'Long-acting basal insulin',
    safetyNote:
      'The wrong concentration, pen, or dose can cause severe hypoglycemia. Do not switch insulin based only on the active-ingredient name.',
    excipientWatch:
      'Injection solutions have specific preservatives and pH. The pen, compatible needle, concentration, and storage instructions must match.',
    pharmacistChecks: [
      'Correct U-100/U-300 concentration and pen',
      'Dose, injection time, and plan for time-zone changes',
      'Cold storage and hypoglycemia response plan',
    ],
    products: {
      VN: p(
        'Lantus SoloStar',
        'Insulin glargine',
        '100 units/mL',
        'Prefilled pen',
        'rx',
        rx,
      ),
      IN: p(
        'Basalog One',
        'Insulin glargine',
        '100 units/mL',
        'Prefilled pen',
        'rx',
        rx,
      ),
      US: p(
        'Lantus SoloStar',
        'Insulin glargine',
        '100 units/mL',
        'Prefilled pen',
        'rx',
        rx,
      ),
      CN: p(
        '来得时 SoloStar',
        '甘精胰岛素',
        '100 units/mL',
        'Prefilled pen',
        'rx',
        rx,
      ),
    },
  },
  {
    id: 'ondansetron',
    inn: 'Ondansetron',
    atc: 'A04AA01',
    purpose: 'Prescription prevention or relief of nausea',
    safetyNote:
      'It may cause constipation, headache, and QT prolongation; risk rises with electrolyte disorders or medicines that affect heart rhythm.',
    excipientWatch:
      'Orally disintegrating tablets may differ in aspartame, gelatin, mannitol, and flavor. Standard and disintegrating tablets are not the same dosage form.',
    pharmacistChecks: [
      'Correct standard-tablet or ODT form',
      'Long QT, low potassium or magnesium, and interacting medicines',
      'Cause of vomiting and signs of dehydration',
    ],
    products: {
      VN: p(
        'Zofran 4 mg',
        'Ondansetron hydrochloride',
        '4 mg',
        'Film-coated tablet',
        'rx',
        rx,
      ),
      IN: p('Ondem 4', 'Ondansetron', '4 mg', 'Tablet', 'rx', rx),
      US: p(
        'Zofran 4 mg',
        'Ondansetron hydrochloride',
        '4 mg',
        'Tablet',
        'rx',
        rx,
      ),
      CN: p('枢丹 4 mg', '盐酸昂丹司琼', '4 mg', 'Tablet', 'rx', rx),
    },
  },
];

export const METHODOLOGY_SOURCES = [
  {
    label: 'WHO — International Nonproprietary Names (INN)',
    url: 'https://www.who.int/teams/health-product-and-policy-standards/inn/',
  },
  {
    label: 'WHO — ATC/DDD classification',
    url: 'https://www.who.int/standards/classifications/other-classifications/the-anatomical-therapeutic-chemical-classification-system-with-defined-daily-doses',
  },
  {
    label: 'NLM — RxNorm normalized drug names',
    url: 'https://www.nlm.nih.gov/research/umls/rxnorm/overview.html',
  },
  {
    label: 'FDA — Orange Book therapeutic-equivalence definitions',
    url: 'https://www.fda.gov/drugs/development-approval-process-drugs/orange-book-preface',
  },
  {
    label: 'NLM — DailyMed current product labeling',
    url: 'https://dailymed.nlm.nih.gov/dailymed/',
  },
];

export function medicationSearchText(medication: MedicationExchange) {
  return [
    medication.inn,
    medication.atc,
    medication.purpose,
    ...Object.values(medication.products).flatMap((product) => [
      product.exampleName,
      product.localIngredient,
    ]),
  ]
    .join(' ')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function pairReview(
  medication: MedicationExchange,
  from: CountryCode,
  to: CountryCode,
) {
  const source = medication.products[from];
  const target = medication.products[to];
  const sameStrength = source.strength === target.strength;
  const sameForm = source.form === target.form;
  const accessChanged = source.access !== target.access;
  return {
    sameStrength,
    sameForm,
    accessChanged,
    requiresExpertReview: true,
    summary:
      sameStrength && sameForm
        ? 'The active ingredient, strength, and described form match, but substitution is still not confirmed.'
        : 'The strength or dosage form differs; do not switch independently.',
  };
}

export function labelForAccess(access: AccessClass, country: CountryCode) {
  if (access === 'rx') return 'Rx · Prescription required';
  if (access === 'verify') return 'Verification required';
  return country === 'IN' ? 'OTC* · Ask a pharmacist' : 'OTC · Nonprescription';
}

export function dailyMedSearchUrl(inn: string) {
  return `https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=${encodeURIComponent(inn.replace(/ \(.+\)$/, ''))}`;
}
