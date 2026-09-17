import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  BROWSER_TISSUE_MODEL_SHA256,
  BROWSER_WOUND_MODEL_SHA256,
  BROWSER_WOUND_MODEL_VERSION,
  BROWSER_WOUND_RUNTIME,
  BROWSER_WOUND_SCHEMA,
  browserWoundInference,
} from '../lib/wound-browser-contract.ts';

function payload() {
  return {
    schema_version: BROWSER_WOUND_SCHEMA,
    runtime: BROWSER_WOUND_RUNTIME,
    wound_model_version: BROWSER_WOUND_MODEL_VERSION,
    wound_model_sha256: BROWSER_WOUND_MODEL_SHA256,
    tissue_model_sha256: BROWSER_TISSUE_MODEL_SHA256,
    source_width: 640,
    source_height: 480,
    visual_width: 256,
    visual_height: 192,
    wound_area_pixels: 1200,
    foreground_fraction: 0.2,
    tissue_percentages: { granulation: 50, slough: 30, necrotic: 15 },
    unclassified_percentage: 5,
    unet_segmentation_mask: 'iVBORw0KGgo' + 'A'.repeat(32),
    tissue_analysis_overlay: 'iVBORw0KGgo' + 'A'.repeat(32),
  };
}

void test('accepts only the pinned browser models and complete tissue denominator', () => {
  assert.deepEqual(browserWoundInference(payload()), payload());
  assert.equal(browserWoundInference({ ...payload(), wound_model_sha256: '0'.repeat(64) }), undefined);
  assert.equal(browserWoundInference({ ...payload(), unclassified_percentage: 6 }), undefined);
});

void test('bounds persisted raster payloads and image dimensions', () => {
  assert.equal(browserWoundInference({ ...payload(), source_width: 20_001 }), undefined);
  assert.equal(browserWoundInference({ ...payload(), visual_width: 257 }), undefined);
  assert.equal(browserWoundInference({ ...payload(), tissue_analysis_overlay: 'not-a-png' }), undefined);
  assert.equal(browserWoundInference({ ...payload(), unet_segmentation_mask: 'iVBORw0KGgo' + 'A'.repeat(450_000) }), undefined);
});

void test('browser model manifest and bytes match the pinned contract', () => {
  const manifest = JSON.parse(readFileSync('public/wound-models/models.json', 'utf8'));
  assert.equal(manifest.runtime, BROWSER_WOUND_RUNTIME);
  assert.equal(manifest.wound_model.sha256, BROWSER_WOUND_MODEL_SHA256);
  assert.equal(manifest.tissue_model.sha256, BROWSER_TISSUE_MODEL_SHA256);
  assert.ok(manifest.wound_model.fixture_mask_iou_vs_fp32 >= 0.9);
  for (const [file, digest] of [
    [manifest.wound_model.file, BROWSER_WOUND_MODEL_SHA256],
    [manifest.tissue_model.file, BROWSER_TISSUE_MODEL_SHA256],
  ]) {
    const actual = createHash('sha256').update(readFileSync('public/wound-models/' + file)).digest('hex');
    assert.equal(actual, digest);
  }
});
