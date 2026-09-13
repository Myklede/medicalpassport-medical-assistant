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
    { code: 'BP', label: 'Blood pressure', value: `${bp[0]}/${bp[1]}`, unit: 'mmHg', reference_range: '90–129 / 60–79 (range on sample chart)', flag: bp[0] >= 130 || bp[1] >= 80 ? 'high' : bp[0] < 90 || bp[1] < 60 ? 'low' : 'normal', recorded_at: date },
    { code: 'FPG', label: 'Fasting plasma glucose', value: fpg, unit: 'mg/dL', reference_range: '70–99', flag: fpg > 99 ? 'high' : fpg < 70 ? 'low' : 'normal', recorded_at: date },
    { code: 'HbA1c', label: 'HbA1c', value: hba1c, unit: '%', reference_range: '4.0–5.6 (lab reference, not a treatment target)', flag: hba1c > 5.6 ? 'high' : hba1c < 4 ? 'low' : 'normal', recorded_at: BASELINE_DATE },
    { code: 'CRP', label: 'C-reactive protein', value: crp, unit: 'mg/L', reference_range: '0–5', flag: crp > 5 ? 'high' : 'normal', recorded_at: date },
    { code: 'WBC', label: 'White blood cell count', value: wbc, unit: '×10⁹/L', reference_range: '4.0–10.0', flag: wbc > 10 ? 'high' : wbc < 4 ? 'low' : 'normal', recorded_at: date },
    { code: 'eGFR', label: 'Estimated glomerular filtration rate', value: egfr, unit: 'mL/min/1.73 m²', reference_range: '≥ 60 (range on sample chart)', flag: egfr < 60 ? 'low' : 'normal', recorded_at: date },
  ];
}

function clinicalVisits(patientId: string, hba1c: number, site: string,
  clinician: WoundClinicalVisit['clinician'], medications: readonly WoundClinicalMedication[],
  offloading: string, observations: readonly VisitObservation[]): readonly WoundClinicalVisit[] {
  return observations.map((o, index) => ({
    visit_id: `${patientId}-clinical-${o.date}`, date: o.date,
    encounter_type: index === 0 ? 'Initial wound assessment' : 'Follow-up & dressing change', clinician,
    summary: o.summary, summary_tone: o.tone, measurements: laboratoryMeasurements(o, hba1c),
    wound: { site, length_cm: o.dimensions[0], width_cm: o.dimensions[1], depth_cm: o.dimensions[2],
      recorded_area_cm2: o.area, edge_state: o.edge, exudate: o.exudate, surrounding_skin: o.skin, pain_score: o.pain,
      tissue_percentages: { granulation: o.tissue[0], slough: o.tissue[1], necrotic: o.tissue[2] },
      measurement_note: 'Measurements and tissue percentages were entered by the clinician in this simulated chart; they are not derived from newly uploaded images. Area is recorded separately and is not inferred as length × width.', procedures: o.procedures,
    },
    medications,
    dressings: [{ name: o.dressing,
      application: o.dressing === 'Foam' ? '10 × 10 cm silicone foam over the cleansed area.' : o.dressing === 'Hydrogel' ? 'A thin layer of sterile hydrogel over the indicated slough area with a non-adherent secondary dressing.' : '5 × 5 cm calcium alginate over the draining area with a non-adherent secondary dressing.',
      schedule: o.dressing === 'Hydrogel' ? 'Every 24 hours according to the sample care plan.' : 'Every 48 hours, or sooner if saturated, according to the sample care plan.',
    }],
    care: { offloading,
      dressing_protocol: 'Sample chart: wash hands, remove the old dressing, cleanse with 0.9% saline, pat the surrounding skin dry, and apply the indicated dressing. Do not add antiseptic or perform debridement independently.',
      monitoring: 'Sample chart: record dressing-change date, drainage, pain, spreading redness, and temperature; contact the care facility if findings change from the last visit.',
      follow_up_date: o.follow_up_date, follow_up_location: 'MediPass Wound Care Clinic — simulated facility',
      additional_notes: [`Plan recorded at the ${o.date} visit; the treating clinician should review it again at follow-up.`, 'HbA1c is a baseline result dated August 28, 2026, carried into the chart rather than repeated at each dressing change.'],
    },
    record_source: 'Combined demonstration chart · patient, clinician, laboratory, and plan data are all simulated.',
  }));
}

const metformin: WoundClinicalMedication = { name: 'Metformin', strength: '500 mg / tablet', dose: '1 tablet (500 mg)', route: 'Oral', schedule: 'Twice daily after breakfast and dinner', status: 'Continue per sample prescription', note: 'Baseline medication in the simulated chart; do not change the dose based on image analysis.' };
const amlodipine: WoundClinicalMedication = { name: 'Amlodipine', strength: '5 mg / tablet', dose: '1 tablet (5 mg)', route: 'Oral', schedule: 'Once each morning', status: 'Continue per sample prescription', note: 'Reconcile the medication list at follow-up.' };

export const MOCK_WOUND_PATIENTS: readonly WoundPatient[] = immutable([
  {
    patient_id: 'SYN000014', display_name: 'Alex Morgan', age: 20, blood_type: 'A-', hba1c_level: 9.6, has_diabetes_type_2: true, hypertension: false,
    fpg_mg_dl: 218, peripheral_vascular_status: 'impaired', vascular_notes: 'Sample chart: toes are slightly cool and the dorsalis pedis pulse is weak; perfusion assessment is pending. Peripheral arterial disease has not been confirmed.',
    neuropathy_status: 'present', neuropathy_notes: 'The sample foot examination records reduced protective sensation.', baseline_recorded_at: BASELINE_DATE,
    clinical_visits: clinicalVisits('SYN000014', 9.6, 'Plantar right foot beneath the first metatarsal head', { name: 'Dr. Maya Collins', specialty: 'Endocrinology & Wound Care' }, [metformin], 'Sample chart: use properly fitted offloading footwear, limit direct pressure on the wound, and inspect pressure points daily.', [
      { date: '2026-09-01', follow_up_date: '2026-09-05', bp: [118, 74], fpg: 218, crp: 6.2, wbc: 8.9, egfr: 108, dimensions: [2.4, 1.8, 0.2], area: 3.8, tissue: [40, 50, 10], edge: 'Mild callus at the edge with no clear epithelialization.', exudate: 'Moderate serous-yellow drainage; no pus recorded.', skin: 'Surrounding skin is mildly dry with no spreading redness recorded.', pain: 1, procedures: ['Cleansed with 0.9% saline.', 'The clinician selectively debrided superficial callus and checked sensation and peripheral pulses.'], dressing: 'Foam', summary: 'Tracking baseline established', tone: 'routine' },
      { date: '2026-09-05', follow_up_date: '2026-09-09', bp: [120, 76], fpg: 210, crp: 6, wbc: 8.7, egfr: 108, dimensions: [2.4, 1.8, 0.2], area: 3.8, tissue: [41, 49, 10], edge: 'Callus remains and the edge has not advanced.', exudate: 'Moderate serous-yellow drainage.', skin: 'Surrounding skin is intact and mildly dry.', pain: 1, procedures: ['Cleansed with 0.9% saline.', 'Offloading footwear fit was reassessed; no further debridement was recorded.'], dressing: 'Foam', summary: 'Size remains nearly unchanged', tone: 'review' },
      { date: '2026-09-09', follow_up_date: '2026-09-12', bp: [118, 72], fpg: 216, crp: 6.3, wbc: 8.8, egfr: 107, dimensions: [2.4, 1.8, 0.2], area: 3.8, tissue: [40, 50, 10], edge: 'No clear edge progress after eight days.', exudate: 'Moderate drainage, similar to the prior visit.', skin: 'No spreading redness recorded; toes were slightly cool on examination.', pain: 1, procedures: ['Cleansed and changed the foam dressing.', 'Stagnation was documented; perfusion assessment and glucose-management review were requested.'], dressing: 'Foam', summary: 'Delayed progress needs review', tone: 'review' },
      { date: '2026-09-12', follow_up_date: '2026-09-15', bp: [120, 74], fpg: 208, crp: 6.1, wbc: 8.6, egfr: 108, dimensions: [2.4, 1.8, 0.2], area: 3.79, tissue: [41, 49, 10], edge: 'Very little change with a thin callused edge remaining.', exudate: 'Moderate drainage; no new finding recorded.', skin: 'Surrounding skin is intact with no spreading redness recorded.', pain: 1, procedures: ['Cleansed with 0.9% saline and changed the dressing.', 'Offloading was checked again; the scheduled vascular and endocrine reviews remain in place.'], dressing: 'Foam', summary: 'Continue close monitoring', tone: 'review' },
    ]),
  },
  {
    patient_id: 'MOCK-002', display_name: 'Jordan Lee', age: 34, blood_type: 'O+', hba1c_level: 5.2, has_diabetes_type_2: false, hypertension: false,
    fpg_mg_dl: 91, peripheral_vascular_status: 'normal', vascular_notes: 'The sample examination records warm limbs, clear peripheral pulses, and capillary refill under two seconds.', neuropathy_status: 'absent', neuropathy_notes: 'The sample examination records intact protective sensation.', baseline_recorded_at: BASELINE_DATE,
    clinical_visits: clinicalVisits('MOCK-002', 5.2, 'Anterior left lower leg — abrasion after simulated trauma', { name: 'Dr. Ethan Brooks', specialty: 'General Surgery' }, [], 'Sample chart: avoid friction and direct pressure over the dressing; adjust activity according to the visit plan.', [
      { date: '2026-09-01', follow_up_date: '2026-09-05', bp: [116, 72], fpg: 91, crp: 2.1, wbc: 6.4, egfr: 112, dimensions: [3, 2, 0.1], area: 5, tissue: [70, 30, 0], edge: 'Shallow, even edge.', exudate: 'Small amount of clear serous drainage.', skin: 'Surrounding skin intact.', pain: 3, procedures: ['Cleansed with 0.9% saline and removed a visible superficial foreign body.', 'Immunization history was reviewed in the sample chart.'], dressing: 'Foam', summary: 'Shallow wound documented', tone: 'routine' },
      { date: '2026-09-05', follow_up_date: '2026-09-09', bp: [114, 72], fpg: 90, crp: 1.8, wbc: 6.2, egfr: 112, dimensions: [2.6, 1.7, 0.1], area: 3.7, tissue: [82, 18, 0], edge: 'A thin epithelial band is visible from the edge.', exudate: 'Small amount of clear serous drainage.', skin: 'Surrounding skin is dry with no swelling recorded.', pain: 2, procedures: ['Gently cleansed with 0.9% saline and changed the dressing.', 'Measurements were repeated at the same site.'], dressing: 'Foam', summary: 'Smaller area and more granulation', tone: 'improving' },
      { date: '2026-09-09', follow_up_date: '2026-09-12', bp: [116, 70], fpg: 92, crp: 1.2, wbc: 6.1, egfr: 113, dimensions: [2, 1.2, 0.1], area: 1.9, tissue: [94, 6, 0], edge: 'Epithelialization is advancing from the edges.', exudate: 'Very little drainage.', skin: 'No spreading redness or swelling recorded.', pain: 1, procedures: ['Cleansed and applied a protective foam dressing.', 'No additional debridement was indicated in the sample chart.'], dressing: 'Foam', summary: 'Continued size reduction', tone: 'improving' },
      { date: '2026-09-12', follow_up_date: '2026-09-19', bp: [116, 72], fpg: 91, crp: 1, wbc: 6, egfr: 112, dimensions: [1.3, 0.8, 0.1], area: 0.8, tissue: [100, 0, 0], edge: 'Edges are approaching with a shallow open area remaining.', exudate: 'Minimal.', skin: 'Surrounding skin intact.', pain: 0, procedures: ['Cleansed and protected the remaining open area with foam.', 'The wound was not yet fully closed; reassessment was scheduled.'], dressing: 'Foam', summary: 'Open area continues to shrink', tone: 'improving' },
    ]),
  },
  {
    patient_id: 'MOCK-003', display_name: 'Patricia Davis', age: 67, blood_type: 'B+', hba1c_level: 7.1, has_diabetes_type_2: true, hypertension: true,
    fpg_mg_dl: 142, peripheral_vascular_status: 'unknown', vascular_notes: 'Mild ankle edema is recorded in the sample chart; arterial perfusion testing is not available for classification.', neuropathy_status: 'present', neuropathy_notes: 'The sample chart records reduced vibration sensation in both feet.', baseline_recorded_at: BASELINE_DATE,
    clinical_visits: clinicalVisits('MOCK-003', 7.1, 'Lateral right ankle', { name: 'Dr. Maya Collins', specialty: 'Endocrinology & Wound Care' }, [metformin, amlodipine], 'Sample chart: prevent footwear from rubbing the ankle, use protective padding as documented, and do not begin compression before perfusion assessment.', [
      { date: '2026-09-01', follow_up_date: '2026-09-05', bp: [138, 82], fpg: 142, crp: 4.8, wbc: 7.7, egfr: 66, dimensions: [2.8, 2, 0.2], area: 4.6, tissue: [50, 45, 5], edge: 'Irregular edge with a small amount of surface slough.', exudate: 'Moderate serous-yellow drainage.', skin: 'Mild ankle edema with no spreading redness recorded.', pain: 2, procedures: ['Cleansed with 0.9% saline.', 'Selective superficial slough debridement was performed at the facility according to the sample chart.'], dressing: 'Alginate', summary: 'Monitor slough and drainage', tone: 'routine' },
      { date: '2026-09-05', follow_up_date: '2026-09-09', bp: [132, 80], fpg: 138, crp: 4.2, wbc: 7.4, egfr: 67, dimensions: [2.7, 1.9, 0.2], area: 4.2, tissue: [58, 39, 3], edge: 'Thin epithelium is present along part of the edge.', exudate: 'Moderate drainage, decreased from the first visit.', skin: 'Mild edema remains; no new skin injury recorded.', pain: 2, procedures: ['Cleansed and changed the alginate and secondary dressing.', 'Surrounding skin and drainage were reassessed.'], dressing: 'Alginate', summary: 'Slight increase in granulation', tone: 'improving' },
      { date: '2026-09-09', follow_up_date: '2026-09-12', bp: [128, 78], fpg: 136, crp: 3.8, wbc: 7.2, egfr: 67, dimensions: [2.5, 1.8, 0.2], area: 3.7, tissue: [65, 33, 2], edge: 'The edge is softer with segmental epithelialization.', exudate: 'Low to moderate.', skin: 'Mild edema with no spreading redness recorded.', pain: 1, procedures: ['Cleansed and changed to foam because drainage decreased in the sample record.', 'The perfusion-study appointment was maintained.'], dressing: 'Foam', summary: 'Area is decreasing gradually', tone: 'improving' },
      { date: '2026-09-12', follow_up_date: '2026-09-19', bp: [128, 76], fpg: 134, crp: 3.5, wbc: 7.1, egfr: 68, dimensions: [2.3, 1.6, 0.15], area: 3.1, tissue: [73, 26, 1], edge: 'Epithelialization continues from the edge.', exudate: 'Low.', skin: 'Mild edema has not increased.', pain: 1, procedures: ['Cleansed and changed the foam dressing.', 'Baseline medications and laboratory schedule were reviewed with the clinician.'], dressing: 'Foam', summary: 'Continued improvement in the chart', tone: 'improving' },
    ]),
  },
  {
    patient_id: 'MOCK-004', display_name: 'Chris Walker', age: 49, blood_type: 'AB-', hba1c_level: 5.6, has_diabetes_type_2: false, hypertension: true,
    fpg_mg_dl: 98, peripheral_vascular_status: 'normal', vascular_notes: 'The sample chart records clear peripheral pulses, warm limbs, and no edema.', neuropathy_status: 'absent', neuropathy_notes: 'Protective sensation is documented as normal in the sample examination.', baseline_recorded_at: BASELINE_DATE,
    clinical_visits: clinicalVisits('MOCK-004', 5.6, 'Anterior right lower leg — shallow wound in a simulated scenario', { name: 'Dr. Ethan Brooks', specialty: 'General Surgery' }, [amlodipine], 'Sample chart: protect the lower leg from pressure and friction during work and alternate activity with rest according to the individual plan.', [
      { date: '2026-09-01', follow_up_date: '2026-09-05', bp: [144, 88], fpg: 98, crp: 3.2, wbc: 7, egfr: 92, dimensions: [2.1, 1.5, 0.1], area: 2.6, tissue: [45, 55, 0], edge: 'Dry edge with a thin layer of slough.', exudate: 'Low; wound bed mildly dry.', skin: 'Surrounding skin intact.', pain: 3, procedures: ['Cleansed with 0.9% saline.', 'Superficial slough was recorded and hydrogel was applied according to the sample chart.'], dressing: 'Hydrogel', summary: 'Care for dry wound bed and slough', tone: 'routine' },
      { date: '2026-09-05', follow_up_date: '2026-09-09', bp: [138, 84], fpg: 97, crp: 2.8, wbc: 6.8, egfr: 93, dimensions: [1.9, 1.3, 0.1], area: 2.1, tissue: [65, 35, 0], edge: 'The edge is less dry with no rolled edge recorded.', exudate: 'Small amount of clear serous drainage.', skin: 'No maceration recorded.', pain: 2, procedures: ['Cleansed and removed loose slough with gauze at the facility.', 'Wound-bed moisture was assessed before changing the hydrogel.'], dressing: 'Hydrogel', summary: 'Slough decreased', tone: 'improving' },
      { date: '2026-09-09', follow_up_date: '2026-09-12', bp: [130, 80], fpg: 98, crp: 2.1, wbc: 6.6, egfr: 92, dimensions: [1.6, 1.1, 0.1], area: 1.4, tissue: [85, 15, 0], edge: 'New epithelium is advancing from the edge.', exudate: 'Low.', skin: 'Surrounding skin is normal in the sample chart.', pain: 1, procedures: ['Cleansed and changed to foam as slough decreased.', 'Blood pressure was measured and sample medications reconciled.'], dressing: 'Foam', summary: 'Wound area decreased', tone: 'improving' },
      { date: '2026-09-12', follow_up_date: '2026-09-19', bp: [126, 78], fpg: 96, crp: 1.7, wbc: 6.5, egfr: 94, dimensions: [1.2, 0.8, 0.1], area: 0.7, tissue: [96, 4, 0], edge: 'Clear epithelialization with a small open area remaining.', exudate: 'Minimal.', skin: 'No new concern recorded.', pain: 0, procedures: ['Cleansed and protected with foam.', 'A closure assessment was scheduled for the next visit.'], dressing: 'Foam', summary: 'Epithelialization continues', tone: 'improving' },
    ]),
  },
  {
    patient_id: 'MOCK-005', display_name: 'Eleanor Thompson', age: 81, blood_type: 'O-', hba1c_level: 10.4, has_diabetes_type_2: true, hypertension: true,
    fpg_mg_dl: 246, peripheral_vascular_status: 'impaired', vascular_notes: 'The sample chart records a weak posterior tibial pulse and cool toes; vascular assessment is scheduled. The degree of ischemia cannot be inferred from an image.', neuropathy_status: 'present', neuropathy_notes: 'The sample chart records reduced protective sensation and numbness in both feet.', baseline_recorded_at: BASELINE_DATE,
    clinical_visits: clinicalVisits('MOCK-005', 10.4, 'Left heel', { name: 'Dr. Laura Bennett', specialty: 'Geriatrics & Vascular Care Coordination' }, [
      { name: 'Insulin glargine', strength: '100 units/mL', dose: '12 units', route: 'Subcutaneous', schedule: '21:00 daily per sample prescription', status: 'Baseline prescription reconciled at the visit', note: 'A simulated dose is recorded; all dose changes require review by the prescriber.' }, amlodipine,
    ], 'Sample chart: use the prescribed heel-suspension device, avoid direct heel pressure while lying down, and have the caregiver assist with repositioning according to the documented plan.', [
      { date: '2026-09-01', follow_up_date: '2026-09-05', bp: [150, 86], fpg: 246, crp: 8.6, wbc: 9.4, egfr: 43, dimensions: [3.5, 2.8, 0.3], area: 8.1, tissue: [25, 45, 30], edge: 'Limited epithelium with a dry dark area at the periphery.', exudate: 'Moderate drainage from the open wound bed.', skin: 'Limb was cool on examination and surrounding skin was thin.', pain: 1, procedures: ['Gently cleansed the open wound bed with 0.9% saline.', 'Dry dark tissue was not debrided before perfusion assessment; vascular referral was documented.'], dressing: 'Foam', summary: 'Perfusion assessment needed', tone: 'review' },
      { date: '2026-09-05', follow_up_date: '2026-09-09', bp: [146, 84], fpg: 238, crp: 9.1, wbc: 9.6, egfr: 43, dimensions: [3.5, 2.8, 0.3], area: 8.1, tissue: [24, 45, 31], edge: 'No clear edge change.', exudate: 'Moderate with no pus recorded.', skin: 'The caregiver reported intermittent pressure on the heel.', pain: 1, procedures: ['Cleansed the open area and applied protective foam.', 'Adjusted the heel-suspension device and reinforced the scheduled specialist visit.'], dressing: 'Foam', summary: 'No size reduction recorded', tone: 'review' },
      { date: '2026-09-09', follow_up_date: '2026-09-12', bp: [144, 82], fpg: 242, crp: 10.2, wbc: 10.3, egfr: 42, dimensions: [3.6, 2.9, 0.3], area: 8.5, tissue: [20, 45, 35], edge: 'Edges remain open and the recorded dark tissue area increased.', exudate: 'Moderate with a slight increase over the open bed.', skin: 'Mild localized redness was documented; infection cannot be determined from color.', pain: 2, procedures: ['Performed direct reassessment, gentle cleansing, and protective dressing.', 'Contacted vascular care the same day because of examination changes; dark-tissue debridement remained deferred.'], dressing: 'Foam', summary: 'Change requires clinician review', tone: 'review' },
      { date: '2026-09-12', follow_up_date: '2026-09-14', bp: [140, 80], fpg: 232, crp: 9.8, wbc: 9.9, egfr: 43, dimensions: [3.6, 2.9, 0.3], area: 8.5, tissue: [21, 44, 35], edge: 'No further edge progress.', exudate: 'Moderate and similar to the previous visit.', skin: 'Localized redness had not increased at this examination.', pain: 2, procedures: ['Cleansed the open area, changed the foam, and checked pressure points.', 'Specialty coordination continued as scheduled; no new perfusion result was available for the sample chart.'], dressing: 'Foam', summary: 'Close monitoring after follow-up', tone: 'review' },
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
