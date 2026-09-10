/** Browser-side contract for a future on-device physical-therapy pose model. */
export type PoseLandmark = {
  name: string;
  x: number;
  y: number;
  z?: number;
  visibility: number;
};

export type TherapyPoseFrame = {
  capturedAtMs: number;
  landmarks: PoseLandmark[];
};

export type TherapyExerciseResult = {
  exerciseId: string;
  repetitions: number;
  rangeOfMotionDegrees: { minimum: number; maximum: number } | null;
  deviations: Array<{
    code: string;
    message: string;
    startedAtMs: number;
    endedAtMs: number;
  }>;
  model: { name: string; version: string };
};

export interface TherapyPoseAdapter {
  start(video: HTMLVideoElement): Promise<void>;
  readFrame(): Promise<TherapyPoseFrame | null>;
  finish(): Promise<TherapyExerciseResult>;
}

export const therapyPoseStatus = {
  connected: false,
  message:
    'The pose-tracking contract is ready, but no pose model is bundled in this build.',
} as const;

