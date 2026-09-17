'use client';

import {
  BROWSER_TISSUE_MODEL_PATH,
  BROWSER_TISSUE_MODEL_SHA256,
  BROWSER_WOUND_MODEL_PATH,
  BROWSER_WOUND_MODEL_SHA256,
  BROWSER_WOUND_MODEL_VERSION,
  BROWSER_WOUND_RUNTIME,
  BROWSER_WOUND_SCHEMA,
  browserWoundInference as validateBrowserWoundInference,
  type BrowserWoundInference,
} from './wound-browser-contract.ts';

const MODEL_SIZE = 256;
const TISSUE_SIZE = 64;
const WOUND_THRESHOLD_LOGIT = Math.log(0.35 / 0.65);
const MIN_FOREGROUND = 0.0025;
const CLOSE_RADIUS = 8;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const PALETTE = [[0, 0, 0], [60, 65, 78], [245, 190, 35], [230, 60, 90]];

type OrtTensor = { data: Float32Array; dims: readonly number[] };
type OrtSession = { run(feeds: Record<string, unknown>): Promise<Record<string, OrtTensor>> };
type OrtModule = {
  env: { wasm: { wasmPaths: string; numThreads: number; proxy: boolean } };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown;
  InferenceSession: { create(path: string, options: Record<string, unknown>): Promise<OrtSession> };
};

let runtimePromise: Promise<OrtModule> | undefined;
let woundSessionPromise: Promise<OrtSession> | undefined;
let tissueSessionPromise: Promise<OrtSession> | undefined;

async function runtime() {
  if (!runtimePromise) runtimePromise = (async () => {
    const host = globalThis as typeof globalThis & { ort?: OrtModule };
    if (!host.ort) await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-medipass-onnx-runtime]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Unable to load the browser inference runtime.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = '/wound-runtime/ort.wasm.min.js';
      script.async = true;
      script.dataset.medipassOnnxRuntime = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Unable to load the browser inference runtime.'));
      document.head.insertAdjacentElement('beforeend', script);
    });
    const runtimeModule = host.ort;
    if (!runtimeModule) throw new Error('The browser inference runtime did not initialize.');
    runtimeModule.env.wasm.wasmPaths = '/wound-runtime/';
    runtimeModule.env.wasm.numThreads = globalThis.crossOriginIsolated
      ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 1)) : 1;
    runtimeModule.env.wasm.proxy = false;
    return runtimeModule;
  })();
  return runtimePromise;
}

async function sessions() {
  const ort = await runtime();
  woundSessionPromise ??= ort.InferenceSession.create(BROWSER_WOUND_MODEL_PATH, {
    executionProviders: ['wasm'], graphOptimizationLevel: 'all', executionMode: 'sequential',
  });
  tissueSessionPromise ??= ort.InferenceSession.create(BROWSER_TISSUE_MODEL_PATH, {
    executionProviders: ['wasm'], graphOptimizationLevel: 'all', executionMode: 'sequential',
  });
  const [wound, tissue] = await Promise.all([woundSessionPromise, tissueSessionPromise]);
  return { ort, wound, tissue };
}

function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width; element.height = height;
  return element;
}

function context(element: HTMLCanvasElement) {
  const result = element.getContext('2d', { willReadFrequently: true });
  if (!result) throw new Error('This browser cannot prepare the wound image.');
  return result;
}

function quality(image: ImageData) {
  let sum = 0, squared = 0, minimum = 255, maximum = 0;
  const pixels = image.width * image.height;
  for (let i = 0; i < image.data.length; i += 4) {
    const value = 0.2126 * image.data[i] + 0.7152 * image.data[i + 1] + 0.0722 * image.data[i + 2];
    sum += value; squared += value * value; minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
  }
  const mean = sum / pixels;
  const variance = squared / pixels - mean * mean;
  if (mean < 6 || mean > 249 || maximum - minimum < 8 || variance < 12) {
    throw new Error('The image is too dark, bright, or uniform for the research model. Use an in-focus photo with even lighting.');
  }
}

function normalizedTensor(image: ImageData) {
  const pixels = image.width * image.height;
  const tensor = new Float32Array(3 * pixels);
  for (let index = 0; index < pixels; index++) {
    const source = index * 4;
    tensor[index] = (image.data[source] / 255 - MEAN[0]) / STD[0];
    tensor[pixels + index] = (image.data[source + 1] / 255 - MEAN[1]) / STD[1];
    tensor[2 * pixels + index] = (image.data[source + 2] / 255 - MEAN[2]) / STD[2];
  }
  return tensor;
}

const disk = (() => {
  const offsets: Array<[number, number]> = [];
  for (let y = -CLOSE_RADIUS; y <= CLOSE_RADIUS; y++) for (let x = -CLOSE_RADIUS; x <= CLOSE_RADIUS; x++) {
    if (x * x + y * y <= CLOSE_RADIUS * CLOSE_RADIUS) offsets.push([x, y]);
  }
  return offsets;
})();

function dilate(source: Uint8Array, width: number, height: number) {
  const output = new Uint8Array(source.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    for (const [dx, dy] of disk) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && source[ny * width + nx]) {
        output[y * width + x] = 1; break;
      }
    }
  }
  return output;
}

function erode(source: Uint8Array, width: number, height: number) {
  const output = new Uint8Array(source.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let keep = true;
    for (const [dx, dy] of disk) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height || !source[ny * width + nx]) {
        keep = false; break;
      }
    }
    if (keep) output[y * width + x] = 1;
  }
  return output;
}

function dominantFilled(source: Uint8Array, width: number, height: number) {
  const closed = erode(dilate(source, width, height), width, height);
  const seen = new Uint8Array(closed.length);
  const queue = new Int32Array(closed.length);
  let dominant: number[] = [];
  for (let seed = 0; seed < closed.length; seed++) {
    if (!closed[seed] || seen[seed]) continue;
    let start = 0, end = 0;
    const component: number[] = [];
    queue[end++] = seed; seen[seed] = 1;
    while (start < end) {
      const index = queue[start++]; component.push(index);
      const x = index % width, y = Math.floor(index / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (closed[next] && !seen[next]) { seen[next] = 1; queue[end++] = next; }
      }
    }
    if (component.length > dominant.length) dominant = component;
  }
  if (dominant.length < Math.max(16, Math.ceil(width * height * MIN_FOREGROUND))) {
    throw new Error('The U-Net did not find a sufficiently large wound region in this image.');
  }
  const component = new Uint8Array(closed.length);
  dominant.forEach(index => { component[index] = 1; });
  const outside = new Uint8Array(component.length);
  let start = 0, end = 0;
  const enqueue = (index: number) => {
    if (!component[index] && !outside[index]) { outside[index] = 1; queue[end++] = index; }
  };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (start < end) {
    const index = queue[start++], x = index % width, y = Math.floor(index / width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) enqueue(ny * width + nx);
    }
  }
  for (let i = 0; i < component.length; i++) if (!outside[i]) component[i] = 1;
  return component;
}

function woundMask(logits: Float32Array) {
  if (logits.length !== MODEL_SIZE * MODEL_SIZE) throw new Error('The U-Net returned an invalid mask.');
  const raw = new Uint8Array(logits.length);
  for (let index = 0; index < logits.length; index++) if (Number.isFinite(logits[index]) && logits[index] > WOUND_THRESHOLD_LOGIT) raw[index] = 1;
  return dominantFilled(raw, MODEL_SIZE, MODEL_SIZE);
}

function tissueInput(image: ImageData, mask: Uint8Array) {
  let x0 = MODEL_SIZE, y0 = MODEL_SIZE, x1 = 0, y1 = 0;
  for (let y = 0; y < MODEL_SIZE; y++) for (let x = 0; x < MODEL_SIZE; x++) if (mask[y * MODEL_SIZE + x]) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
  }
  const width = x1 - x0, height = y1 - y0;
  if (width <= 0 || height <= 0) throw new Error('The U-Net mask is empty.');
  const crop = canvas(width, height), cropContext = context(crop);
  const cropPixels = cropContext.createImageData(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sourceIndex = (y0 + y) * MODEL_SIZE + x0 + x;
    const target = (y * width + x) * 4;
    if (mask[sourceIndex]) {
      const source = sourceIndex * 4;
      cropPixels.data[target] = image.data[source];
      cropPixels.data[target + 1] = image.data[source + 1];
      cropPixels.data[target + 2] = image.data[source + 2];
    }
    cropPixels.data[target + 3] = 255;
  }
  cropContext.putImageData(cropPixels, 0, 0);
  const reduced = canvas(TISSUE_SIZE, TISSUE_SIZE), reducedContext = context(reduced);
  reducedContext.imageSmoothingEnabled = true;
  reducedContext.drawImage(crop, 0, 0, TISSUE_SIZE, TISSUE_SIZE);
  const reducedPixels = reducedContext.getImageData(0, 0, TISSUE_SIZE, TISSUE_SIZE);
  const tensor = new Float32Array(3 * TISSUE_SIZE * TISSUE_SIZE);
  for (let y = 0; y < TISSUE_SIZE; y++) for (let x = 0; x < TISSUE_SIZE; x++) {
    const sourceX = Math.min(width - 1, Math.floor(x * width / TISSUE_SIZE));
    const sourceY = Math.min(height - 1, Math.floor(y * height / TISSUE_SIZE));
    const index = y * TISSUE_SIZE + x;
    if (!mask[(y0 + sourceY) * MODEL_SIZE + x0 + sourceX]) continue;
    const source = index * 4;
    tensor[index] = reducedPixels.data[source] / 255;
    tensor[TISSUE_SIZE * TISSUE_SIZE + index] = reducedPixels.data[source + 1] / 255;
    tensor[2 * TISSUE_SIZE * TISSUE_SIZE + index] = reducedPixels.data[source + 2] / 255;
  }
  return { tensor, bounds: { x0, y0, x1, y1 } };
}

function tissueLabels(logits: Float32Array) {
  const pixels = TISSUE_SIZE * TISSUE_SIZE;
  if (logits.length !== 4 * pixels) throw new Error('The tissue U-Net returned invalid labels.');
  const labels = new Uint8Array(pixels);
  for (let index = 0; index < pixels; index++) {
    let label = 0, best = logits[index];
    if (!Number.isFinite(best)) throw new Error('The tissue U-Net returned non-finite values.');
    for (let candidate = 1; candidate < 4; candidate++) {
      const value = logits[candidate * pixels + index];
      if (!Number.isFinite(value)) throw new Error('The tissue U-Net returned non-finite values.');
      if (value > best) { best = value; label = candidate; }
    }
    labels[index] = label;
  }
  return labels;
}

function alignedLabel(x: number, y: number, bounds: { x0: number; y0: number; x1: number; y1: number }, labels: Uint8Array) {
  if (x < bounds.x0 || x >= bounds.x1 || y < bounds.y0 || y >= bounds.y1) return 0;
  const tx = Math.min(TISSUE_SIZE - 1, Math.floor((x - bounds.x0) * TISSUE_SIZE / (bounds.x1 - bounds.x0)));
  const ty = Math.min(TISSUE_SIZE - 1, Math.floor((y - bounds.y0) * TISSUE_SIZE / (bounds.y1 - bounds.y0)));
  return labels[ty * TISSUE_SIZE + tx];
}

function percentages(mask: Uint8Array, labels: Uint8Array, bounds: { x0: number; y0: number; x1: number; y1: number }) {
  const counts = [0, 0, 0, 0];
  for (let y = 0; y < MODEL_SIZE; y++) for (let x = 0; x < MODEL_SIZE; x++) if (mask[y * MODEL_SIZE + x]) {
    counts[alignedLabel(x, y, bounds, labels)]++;
  }
  const total = counts.reduce((sum, value) => sum + value, 0);
  if (!total) throw new Error('The model did not produce measurable wound pixels.');
  return {
    tissue: { necrotic: 100 * counts[1] / total, slough: 100 * counts[2] / total, granulation: 100 * counts[3] / total },
    unclassified: 100 * counts[0] / total,
    foreground: total / (MODEL_SIZE * MODEL_SIZE),
  };
}

function boundary(mask: Uint8Array, width: number, x: number, y: number) {
  const height = mask.length / width;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height || !mask[ny * width + nx]) return true;
  }
  return false;
}

async function base64Png(element: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => element.toBlob(value => value ? resolve(value) : reject(new Error('Unable to encode pipeline image.')), 'image/png'));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000) binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  return btoa(binary);
}

async function visuals(bitmap: ImageBitmap, mask: Uint8Array, labels: Uint8Array, bounds: { x0: number; y0: number; x1: number; y1: number }) {
  const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const originalCanvas = canvas(width, height), originalContext = context(originalCanvas);
  originalContext.imageSmoothingEnabled = true;
  originalContext.drawImage(bitmap, 0, 0, width, height);
  const original = originalContext.getImageData(0, 0, width, height);
  const maskAt = (x: number, y: number) => mask[Math.min(MODEL_SIZE - 1, Math.floor(y * MODEL_SIZE / height)) * MODEL_SIZE
    + Math.min(MODEL_SIZE - 1, Math.floor(x * MODEL_SIZE / width))];
  const modelPoint = (x: number, y: number) => ({
    x: Math.min(MODEL_SIZE - 1, Math.floor(x * MODEL_SIZE / width)),
    y: Math.min(MODEL_SIZE - 1, Math.floor(y * MODEL_SIZE / height)),
  });
  const unetCanvas = canvas(width, height), unetContext = context(unetCanvas);
  const unet = unetContext.createImageData(width, height);
  const tissueCanvas = canvas(width, height), tissueContext = context(tissueCanvas);
  const overlay = tissueContext.createImageData(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const target = (y * width + x) * 4;
    overlay.data.set(original.data.subarray(target, target + 4), target);
    if (!maskAt(x, y)) continue;
    unet.data.set(original.data.subarray(target, target + 4), target);
    const point = modelPoint(x, y);
    if (boundary(mask, MODEL_SIZE, point.x, point.y)) {
      unet.data[target] = 0; unet.data[target + 1] = 210; unet.data[target + 2] = 255; unet.data[target + 3] = 255;
    }
    const label = alignedLabel(point.x, point.y, bounds, labels);
    if (label > 0) for (let channel = 0; channel < 3; channel++) {
      overlay.data[target + channel] = Math.round(0.45 * original.data[target + channel] + 0.55 * PALETTE[label][channel]);
    }
  }
  unetContext.putImageData(unet, 0, 0);
  tissueContext.putImageData(overlay, 0, 0);
  const [unetBase64, tissueBase64] = await Promise.all([base64Png(unetCanvas), base64Png(tissueCanvas)]);
  return { width, height, unetBase64, tissueBase64 };
}

export async function analyzeWoundInBrowser(file: File): Promise<BrowserWoundInference> {
  if (!['image/png', 'image/jpeg'].includes(file.type) || !file.size) throw new Error('Choose a non-empty PNG or JPEG image.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('The selected image could not be decoded.'); }
  try {
    if (bitmap.width < 64 || bitmap.height < 64 || bitmap.width > 20_000 || bitmap.height > 20_000) {
      throw new Error('Use a wound image between 64 and 20,000 pixels on each side.');
    }
    const modelCanvas = canvas(MODEL_SIZE, MODEL_SIZE), modelContext = context(modelCanvas);
    modelContext.imageSmoothingEnabled = true;
    modelContext.drawImage(bitmap, 0, 0, MODEL_SIZE, MODEL_SIZE);
    const image = modelContext.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
    quality(image);
    const { ort, wound, tissue } = await sessions();
    const woundOutput = await wound.run({ image: new ort.Tensor('float32', normalizedTensor(image), [1, 3, MODEL_SIZE, MODEL_SIZE]) });
    const mask = woundMask(woundOutput.logits?.data);
    const tissuePrepared = tissueInput(image, mask);
    const tissueOutput = await tissue.run({ image: new ort.Tensor('float32', tissuePrepared.tensor, [1, 3, TISSUE_SIZE, TISSUE_SIZE]) });
    const labels = tissueLabels(tissueOutput.logits?.data);
    const measured = percentages(mask, labels, tissuePrepared.bounds);
    const rendered = await visuals(bitmap, mask, labels, tissuePrepared.bounds);
    const result = {
      schema_version: BROWSER_WOUND_SCHEMA,
      runtime: BROWSER_WOUND_RUNTIME,
      wound_model_version: BROWSER_WOUND_MODEL_VERSION,
      wound_model_sha256: BROWSER_WOUND_MODEL_SHA256,
      tissue_model_sha256: BROWSER_TISSUE_MODEL_SHA256,
      source_width: bitmap.width,
      source_height: bitmap.height,
      visual_width: rendered.width,
      visual_height: rendered.height,
      wound_area_pixels: Math.max(1, Math.round(measured.foreground * bitmap.width * bitmap.height)),
      foreground_fraction: measured.foreground,
      tissue_percentages: measured.tissue,
      unclassified_percentage: measured.unclassified,
      unet_segmentation_mask: rendered.unetBase64,
      tissue_analysis_overlay: rendered.tissueBase64,
    };
    const validated = validateBrowserWoundInference(result);
    if (!validated) throw new Error('The browser model result exceeded the safe hosted-data limits.');
    return validated;
  } finally { bitmap.close(); }
}
