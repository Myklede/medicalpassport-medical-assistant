import type { TissueComposition } from './wound-api.ts';

export const BROWSER_WOUND_SCHEMA = 'medipass-browser-wound-inference-v1';
export const BROWSER_WOUND_RUNTIME = 'onnxruntime-web@1.30.0';
export const BROWSER_WOUND_MODEL_VERSION = 'pwc-fusd-resnet34-unet-browser-int8-v1';
export const BROWSER_WOUND_MODEL_PATH = '/wound-models/wound_unet_int8.onnx';
export const BROWSER_TISSUE_MODEL_PATH = '/wound-models/tissue_unet_fp32.onnx';
export const BROWSER_WOUND_MODEL_SHA256 = '76de73e2340966dd5f37ea65a82511f8720ef0e894d596f324824d2995d30667';
export const BROWSER_TISSUE_MODEL_SHA256 = '5a66a3bcd92d8941dcb5d796964fb1dc7803acc9a582b9575ab9eb82256682ea';

export type BrowserWoundInference = {
  schema_version: typeof BROWSER_WOUND_SCHEMA;
  runtime: typeof BROWSER_WOUND_RUNTIME;
  wound_model_version: typeof BROWSER_WOUND_MODEL_VERSION;
  wound_model_sha256: typeof BROWSER_WOUND_MODEL_SHA256;
  tissue_model_sha256: typeof BROWSER_TISSUE_MODEL_SHA256;
  source_width: number;
  source_height: number;
  visual_width: number;
  visual_height: number;
  wound_area_pixels: number;
  foreground_fraction: number;
  tissue_percentages: TissueComposition;
  unclassified_percentage: number;
  unet_segmentation_mask: string;
  tissue_analysis_overlay: string;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function png(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 16 && value.length <= 450_000
    && value.startsWith('iVBORw0KGgo') && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function browserWoundInference(value: unknown): BrowserWoundInference | undefined {
  if (!record(value)
      || value.schema_version !== BROWSER_WOUND_SCHEMA
      || value.runtime !== BROWSER_WOUND_RUNTIME
      || value.wound_model_version !== BROWSER_WOUND_MODEL_VERSION
      || value.wound_model_sha256 !== BROWSER_WOUND_MODEL_SHA256
      || value.tissue_model_sha256 !== BROWSER_TISSUE_MODEL_SHA256
      || !Number.isInteger(value.source_width) || !finite(value.source_width, 1, 20_000)
      || !Number.isInteger(value.source_height) || !finite(value.source_height, 1, 20_000)
      || !Number.isInteger(value.visual_width) || !finite(value.visual_width, 1, 256)
      || !Number.isInteger(value.visual_height) || !finite(value.visual_height, 1, 256)
      || !Number.isInteger(value.wound_area_pixels) || !finite(value.wound_area_pixels, 1, 400_000_000)
      || !finite(value.foreground_fraction, 0.0025, 1)
      || !record(value.tissue_percentages)
      || !finite(value.tissue_percentages.granulation, 0, 100)
      || !finite(value.tissue_percentages.slough, 0, 100)
      || !finite(value.tissue_percentages.necrotic, 0, 100)
      || !finite(value.unclassified_percentage, 0, 100)
      || !png(value.unet_segmentation_mask)
      || !png(value.tissue_analysis_overlay)) return;
  const total = value.tissue_percentages.granulation + value.tissue_percentages.slough
    + value.tissue_percentages.necrotic + value.unclassified_percentage;
  if (Math.abs(total - 100) >= 0.1) return;
  return value as BrowserWoundInference;
}
