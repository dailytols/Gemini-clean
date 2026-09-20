export type InpaintingMethod = 'auto' | 'telea' | 'navier-stokes';
export type OutputFormat = 'png' | 'jpg';
export type ProcessingMode = 'balanced' | 'quality' | 'low-memory';

export interface AppSettings {
  detectionConfidence: number; // e.g., 0.70, 0.80, 0.90
  inpaintingMethod: InpaintingMethod;
  outputFormat: OutputFormat;
  jpgQuality: number; // 80, 90, 95, 100
  processingMode: ProcessingMode;
  useServerProcessing: boolean; // defaults to false, explicit toggle only
}

export const DEFAULT_SETTINGS: AppSettings = {
  detectionConfidence: 0.70,
  inpaintingMethod: 'auto',
  outputFormat: 'png',
  jpgQuality: 95,
  processingMode: 'balanced',
  useServerProcessing: false,
};
