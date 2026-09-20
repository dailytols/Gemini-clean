import { DetectionResult } from './detection';

export type ImageStatus =
  | 'QUEUED'
  | 'DETECTING'
  | 'MASKING'
  | 'INPAINTING'
  | 'FINALIZING'
  | 'DONE'
  | 'ERROR';

export interface QueueImage {
  id: string;
  file: File;
  name: string;
  size: number;
  width?: number;
  height?: number;
  originalUrl: string; // Object URL
  cleanedUrl?: string; // Object URL of the processed image
  thumbnailUrl: string; // Low-res version for list preview
  status: ImageStatus;
  progress: number; // 0 to 100
  error?: string;
  detection?: DetectionResult;
  processingTime?: number; // in milliseconds
  customMaskData?: Uint8ClampedArray; // For manual fine-tuning edits
  verified?: boolean;
  verifiedDimensions?: string;
  verifiedMsg?: string;
  outputWidth?: number;
  outputHeight?: number;
  outputFormatSelected?: string;
}
