import type { ClinicalBrief, PipelineVisuals, WoundVisit } from './wound-api.ts';

export type WoundLanguage = 'vi' | 'en';
export type HealingStatus = 'improving' | 'stagnant' | 'deteriorating' | 'insufficient_data';

export function woundRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function woundText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function woundNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Retain the numeric precision returned by the API; never round a small delta to zero. */
export function measuredNumber(value: unknown, signed = false): string {
  const amount = woundNumber(value);
  return amount === undefined ? '—' : `${signed && amount > 0 ? '+' : ''}${Object.is(amount, -0) ? 0 : amount}`;
}

export function selectedWoundVisit(brief: ClinicalBrief, day?: number): WoundVisit | undefined {
  return day === undefined ? brief.objective_measurements.visits.at(-1)
    : brief.objective_measurements.visits.find(visit => visit.day === day);
}

export function patientEducation(brief: ClinicalBrief, language: WoundLanguage): Record<string, unknown> {
  const assessment = woundRecord(brief.trajectory_risk_assessment);
  const explanation = woundRecord(brief.patient_explanation ?? assessment.patient_explanation);
  return woundRecord(woundRecord(explanation.locales)[language]);
}

export function trajectoryPresentation(brief: ClinicalBrief) {
  const assessment = woundRecord(brief.trajectory_risk_assessment);
  const comparison = woundRecord(assessment.latest_comparison ?? brief.objective_measurements.latest_change);
  const latest = brief.objective_measurements.visits.at(-1);
  const previous = brief.objective_measurements.visits.at(-2);
  // A stale comparison must not describe a subsequently failed/missing capture.
  const pairMatches = !!latest && !!previous && comparison.to_day === latest.day && comparison.from_day === previous.day;
  const usable = (visit: WoundVisit | undefined) => !!visit && woundRecord(visit.quality).usable_for_demo !== false
    && (visit.measurement_status === undefined || visit.measurement_status === 'available');
  const comparable = pairMatches && comparison.comparison_consistent === true && usable(latest) && usable(previous);
  const tissueAvailable = comparable && comparison.tissue_comparison_available === true && !!latest?.tissue_percentages && !!previous?.tissue_percentages;
  const areaAvailable = comparable && comparison.area_comparison_available === true;
  const pixelsAvailable = comparable && woundNumber(comparison.area_change_pixels) !== undefined;
  const pixelTrendAvailable = pixelsAvailable && comparison.pixel_comparison_supports_trend === true;
  const highRisk = woundRecord(assessment.non_healing_trajectory);
  const flags = Array.isArray(assessment.risk_alerts) ? assessment.risk_alerts.map(woundRecord) : [];
  const highRiskFlag = flags.find(flag => flag.rule_id === 'high_risk_non_healing_trajectory' && flag.scope === 'latest');
  // The backend owns clinical rules. Absence of a flag is never an improving badge.
  const declared = typeof assessment.healing_status === 'string' ? assessment.healing_status
    : woundText(woundRecord(assessment.healing_status).status);
  const supported = tissueAvailable && (declared !== 'improving' || areaAvailable || pixelTrendAvailable);
  const status: HealingStatus = supported && ['improving', 'stagnant', 'deteriorating'].includes(declared)
    ? declared as HealingStatus : 'insufficient_data';
  return {
    assessment, comparison, comparable, tissueAvailable, areaAvailable, pixelsAvailable, pixelTrendAvailable,
    tissueDeltas: tissueAvailable ? woundRecord(comparison.change_percentage_points) : {},
    status,
    highRiskNonHealing: !!highRiskFlag || highRisk.flagged === true,
    nonHealing: highRisk,
    highRiskFlag,
    flags,
  };
}

/** Only bounded raster bytes or the three exact bundled demo rasters are renderable. */
export function woundRasterSource(value: unknown, mime: unknown): string | undefined {
  if (typeof value !== 'string' || !value.length || value.length > 12_000_000) return;
  if (/^\/wound-demo\/day_007_(?:rgb|mask|overlay)\.png$/.test(value)) return value;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || !['image/png', 'image/jpeg'].includes(String(mime))) return;
  return `data:${String(mime)};base64,${value}`;
}

/** Never show the most recent pipeline beside a different selected visit. */
export function selectedPipelineVisuals(brief: ClinicalBrief, day?: number, supplied?: PipelineVisuals): PipelineVisuals {
  if (supplied) return supplied;
  return day === undefined || day === brief.objective_measurements.visits.at(-1)?.day ? brief.pipeline_visuals ?? {} : {};
}

/** Recover same-capture measurements when an older visit projection omitted them. */
export function reconciledWoundVisit(visit: WoundVisit | undefined, visuals: PipelineVisuals): WoundVisit | undefined {
  if (!visit || visit.analysis_status === 'pending_model' || visuals.status !== 'available') return visit;
  if (woundNumber(visuals.day) !== undefined && visuals.day !== visit.day) return visit;
  const measurements = woundRecord(visuals.wound_measurements);
  if (measurements.measurement_status !== 'available') return visit;
  const tissue = woundRecord(measurements.tissue_percentages);
  const granulation = woundNumber(tissue.granulation);
  const slough = woundNumber(tissue.slough);
  const necrotic = woundNumber(tissue.necrotic);
  const unclassified = woundNumber(measurements.unclassified_percentage);
  if ([granulation, slough, necrotic, unclassified].some(value => value === undefined || value < 0 || value > 100)) return visit;
  if (Math.abs(granulation! + slough! + necrotic! + unclassified! - 100) >= 0.1) return visit;
  return {
    ...visit,
    measurement_status: 'available',
    measurement_source: typeof measurements.measurement_source === 'string' ? measurements.measurement_source : visit.measurement_source,
    tissue_percentages: visit.tissue_percentages ?? { granulation: granulation!, slough: slough!, necrotic: necrotic! },
    unclassified_percentage: woundNumber(visit.unclassified_percentage) ?? unclassified!,
    wound_area_pixels: woundNumber(visit.wound_area_pixels) ?? woundNumber(measurements.wound_area_pixels) ?? null,
  };
}
