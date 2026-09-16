import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ClinicalBrief, WoundVisit } from '../lib/wound-api.ts';
import {
  measuredNumber, patientEducation, selectedPipelineVisuals, selectedWoundVisit,
  reconciledWoundVisit, trajectoryPresentation, woundRasterSource,
} from '../lib/wound-presentation.ts';

const visit = (day: number): WoundVisit => ({
  day, tissue_percentages: { granulation: 50, slough: 30, necrotic: 20 },
  risk_deterioration_score: .4, quality: { usable_for_demo: true }, measurement_status: 'available',
  wound_area_pixels: 12000, area_cm2: 2.5,
});

function brief(): ClinicalBrief {
  return {
    objective_measurements: { trajectory_available: true, visits: [visit(0), visit(7)] },
    multimodal_context_analysis: 'Source narrative', system_recommendation: 'Source guidance',
    trajectory_risk_assessment: {
      healing_status: 'improving',
      latest_comparison: {
        from_day: 0, to_day: 7, elapsed_days: 7, comparison_consistent: true,
        tissue_comparison_available: true, area_comparison_available: true,
        area_change_cm2: -.25005, area_change_pixels: -1234,
        pixel_comparison_supports_trend: true,
        change_percentage_points: { granulation: 5, slough: -3, necrotic: -2 },
      },
    },
    pipeline_visuals: { status: 'available', original_image: 'dGVzdA==', original_mime_type: 'image/png' },
  };
}

void test('retains raw area and tissue deltas without rounding small nonzero changes away', () => {
  const result = trajectoryPresentation(brief());
  assert.equal(result.status, 'improving');
  assert.equal(result.comparison.area_change_cm2, -.25005);
  assert.deepEqual(result.tissueDeltas, { granulation: 5, slough: -3, necrotic: -2 });
  assert.equal(measuredNumber(-.00000001, true), '-1e-8');
  assert.equal(measuredNumber(1234, true), '+1234');
  assert.equal(measuredNumber(null), '—');
  assert.equal(measuredNumber(NaN), '—');
});

void test('a single capture or stale interval can never inherit an improving badge', () => {
  const single = brief();
  single.objective_measurements.visits = [visit(7)];
  assert.equal(trajectoryPresentation(single).status, 'insufficient_data');
  const later = brief();
  later.objective_measurements.visits.push(visit(14));
  const result = trajectoryPresentation(later);
  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.areaAvailable, false);
  assert.deepEqual(result.tissueDeltas, {});
});

void test('incomparable pixel deltas remain available without supporting an improving status', () => {
  const source = brief();
  const assessment = source.trajectory_risk_assessment as Record<string, unknown>;
  const comparison = assessment.latest_comparison as Record<string, unknown>;
  comparison.area_comparison_available = false;
  comparison.area_change_cm2 = null;
  comparison.pixel_comparison_supports_trend = false;
  const result = trajectoryPresentation(source);
  assert.equal(result.pixelsAvailable, true);
  assert.equal(result.comparison.area_change_pixels, -1234);
  assert.equal(result.status, 'insufficient_data');
  // A tissue-only worsening rule remains visible without asserting physical area change.
  assessment.healing_status = 'deteriorating';
  assert.equal(trajectoryPresentation(source).status, 'deteriorating');
});

void test('unusable or missing tissue in the latest capture cannot produce an improving badge', () => {
  for (const bad of [{ quality: { usable_for_demo: false } }, { measurement_status: 'unavailable' }, { tissue_percentages: null }]) {
    const source = brief();
    Object.assign(source.objective_measurements.visits[1], bad);
    assert.equal(trajectoryPresentation(source).status, 'insufficient_data');
  }
});

void test('no warning is not an improving classification; high-risk alert comes from backend facts', () => {
  const source = brief();
  const assessment = source.trajectory_risk_assessment as Record<string, unknown>;
  delete assessment.healing_status;
  assessment.risk_alerts = [];
  assert.equal(trajectoryPresentation(source).status, 'insufficient_data');
  assert.equal(trajectoryPresentation(source).highRiskNonHealing, false);
  assessment.non_healing_trajectory = { flagged: true, elapsed_days: 7 };
  assert.equal(trajectoryPresentation(source).highRiskNonHealing, true);
});

void test('a selected historical visit cannot fall back to the newest capture or newest pipeline', () => {
  const source = brief();
  assert.equal(selectedWoundVisit(source, 99), undefined);
  assert.equal(selectedWoundVisit(source, 0)?.day, 0);
  assert.deepEqual(selectedPipelineVisuals(source, 0), {});
  assert.equal(selectedPipelineVisuals(source, 7), source.pipeline_visuals);
  const selected = { status: 'available', original_image: 'c2VsZWN0ZWQ=' };
  assert.equal(selectedPipelineVisuals(source, 0, selected), selected);
});

void test('localized education retains the entire selected locale without flattening or truncating actions', () => {
  const source = brief();
  const vi = {
    simple_explanation: 'One image', baseline_context: 'HbA1c 9.6%', why_this_matters: 'Why it matters',
    possible_consequences: 'Possible consequences', what_to_do: Array.from({ length: 12 }, (_, index) => ({ action_id: String(index), text: `Action ${index}` })),
    when_to_seek_care: 'Contact a clinician', measurement_note: 'Estimate', rule_note: 'Research rule', safety_note: 'Safety note',
  };
  const en = { ...vi, simple_explanation: 'One image' };
  source.patient_explanation = { locales: { vi, en } };
  assert.equal(patientEducation(source, 'vi'), vi);
  assert.equal(patientEducation(source, 'en'), en);
  assert.deepEqual(patientEducation({ ...source, patient_explanation: {} }, 'vi'), {});
});

void test('pipeline sources accept bounded raster bytes only, never SVG or a remote URL', () => {
  assert.equal(woundRasterSource('dGVzdA==', 'image/png'), 'data:image/png;base64,dGVzdA==');
  assert.equal(woundRasterSource('dGVzdA==', 'image/svg+xml'), undefined);
  assert.equal(woundRasterSource('https://example.com/a.png', 'image/png'), undefined);
  assert.equal(woundRasterSource('a'.repeat(12_000_001), 'image/png'), undefined);
});

void test('same-capture pipeline measurements restore tissue cards omitted by an older visit projection', () => {
  const source = visit(7);
  source.tissue_percentages = null;
  source.wound_area_pixels = null;
  const restored = reconciledWoundVisit(source, {
    day: 7, status: 'available', wound_measurements: {
      measurement_status: 'available', measurement_source: 'binary_wound_mask_v2',
      tissue_percentages: { granulation: 61, slough: 24, necrotic: 15 },
      unclassified_percentage: 0, wound_area_pixels: 2345,
    },
  });
  assert.deepEqual(restored?.tissue_percentages, { granulation: 61, slough: 24, necrotic: 15 });
  assert.equal(restored?.wound_area_pixels, 2345);
  assert.equal(reconciledWoundVisit(source, { day: 0, status: 'available', wound_measurements: {} }), source);
});
