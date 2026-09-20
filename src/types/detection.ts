export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionResult {
  detected: boolean;
  confidence: number;
  bbox: BoundingBox | null;
  maskUrl?: string; // Data URL for the visual mask display
  maskData?: Uint8ClampedArray; // The raw mask transparency bytes (for editor/inpainting)
  detectorName: string; // 'Template matching' | 'ONNX Object Detection' | 'OpenCV Fallback' | 'Fallback visible-mark detector'
}
