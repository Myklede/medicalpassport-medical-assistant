/**
 * Application-side contract for the future model hosted from `aimedic/`.
 *
 * Keep model training, weights, and preprocessing in `aimedic/`. The web app
 * should depend only on this versioned contract so either side can evolve
 * without importing Python or model files into the Cloudflare Worker bundle.
 */
export type WoundModelInput = {
  assessmentId: string;
  imageObjectId: string;
  previousAssessmentIds: string[];
  patientContext: Array<{
    resourceType: string;
    codeSystem: string | null;
    code: string | null;
    display: string;
  }>;
  capture: {
    modality: 'rgb';
    hasScaleMarker: boolean;
    bodyLocation: string;
    capturedAt: string;
  };
};

export type WoundModelOutput = {
  contractVersion: '1.0';
  model: { name: string; version: string; datasetVersion: string };
  quality: { usable: boolean; reasons: string[] };
  segmentation: {
    maskObjectId: string | null;
    areaMm2: number | null;
    uncertainty: number | null;
  };
  tissue: Array<{ label: string; proportion: number; uncertainty: number }>;
  trajectory: {
    direction: 'improving' | 'stable' | 'worsening' | 'insufficient-data';
    uncertainty: number | null;
  };
  warnings: string[];
};

export interface WoundModelAdapter {
  analyze(input: WoundModelInput): Promise<WoundModelOutput>;
}

export const woundModelStatus = {
  connected: false,
  contractVersion: '1.0',
  message:
    'No trained wound model is connected. Photos are stored for longitudinal research review only.',
} as const;

