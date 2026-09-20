import { BoundingBox, DetectionResult } from '../types/detection';

/**
 * Renders the canonical Gemini double-sparkle logo on a temporary canvas
 */
export function drawGeminiLogoTemplate(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#FFFFFF';

  // Helper to draw a single 4-point sparkle/star
  const drawSparkle = (cx: number, cy: number, rx: number, ry: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry); // Top
    ctx.quadraticCurveTo(cx, cy, cx + rx, cy); // Top to Right
    ctx.quadraticCurveTo(cx, cy, cx, cy + ry); // Right to Bottom
    ctx.quadraticCurveTo(cx, cy, cx - rx, cy); // Bottom to Left
    ctx.quadraticCurveTo(cx, cy, cx, cy - ry); // Left to Top
    ctx.closePath();
    ctx.fill();
  };

  // Draw main sparkle in the center/slightly right
  const mainX = width * 0.6;
  const mainY = height * 0.55;
  const mainR = Math.min(width, height) * 0.35;
  drawSparkle(mainX, mainY, mainR, mainR);

  // Draw smaller sparkle at top-left
  const smallX = width * 0.25;
  const smallY = height * 0.25;
  const smallR = mainR * 0.5;
  drawSparkle(smallX, smallY, smallR, smallR);

  return canvas;
}

/**
 * Searches the corner regions of an image for a pixel signature matching the Gemini double-sparkle template
 * Hyper-accelerated by downscaling the corner region to a maximum dimension of 250px.
 */
export async function matchTemplate(
  imageElement: HTMLImageElement,
  confidenceThreshold: number
): Promise<DetectionResult | null> {
  const w = imageElement.naturalWidth;
  const h = imageElement.naturalHeight;

  const padding = Math.max(16, Math.round(Math.min(w, h) * 0.02));

  // Corner scan region (bottom-right 25%)
  const brW = Math.round(w * 0.25);
  const brH = Math.round(h * 0.25);
  const zoneX = w - brW - padding;
  const zoneY = h - brH - padding;

  if (zoneX < 0 || zoneY < 0 || brW <= 0 || brH <= 0) return null;

  // Downscale the search zone for hyper-fast template matching (max dimension 250px)
  const maxDim = 250;
  const scale = Math.min(1, maxDim / Math.max(brW, brH));
  const scaledZoneW = Math.round(brW * scale);
  const scaledZoneH = Math.round(brH * scale);

  const zoneCanvas = document.createElement('canvas');
  zoneCanvas.width = scaledZoneW;
  zoneCanvas.height = scaledZoneH;
  const zCtx = zoneCanvas.getContext('2d');
  if (!zCtx) return null;

  // Draw ONLY the bottom-right region, downscaled
  zCtx.drawImage(
    imageElement,
    zoneX, zoneY, brW, brH, // Source region
    0, 0, scaledZoneW, scaledZoneH // Destination
  );

  const imgData = zCtx.getImageData(0, 0, scaledZoneW, scaledZoneH);
  const data = imgData.data;

  // Use smaller templates for the downscaled canvas
  const templateSizes = [16, 24, 32, 40];

  for (const size of templateSizes) {
    if (size > scaledZoneW || size > scaledZoneH) continue;

    const templateCanvas = drawGeminiLogoTemplate(size, size);
    const tCtx = templateCanvas.getContext('2d');
    if (!tCtx) continue;
    const tData = tCtx.getImageData(0, 0, size, size);
    const tBytes = tData.data;

    const step = 2; // Fixed small step is extremely fast on small canvas!
    let bestScore = -1;
    let bestX = 0;
    let bestY = 0;

    for (let sy = 0; sy < scaledZoneH - size; sy += step) {
      for (let sx = 0; sx < scaledZoneW - size; sx += step) {
        let sumDiff = 0;
        let sumWeight = 0;

        for (let ty = 0; ty < size; ty++) {
          for (let tx = 0; tx < size; tx++) {
            const tIdx = (ty * size + tx) * 4;
            const tAlpha = tBytes[tIdx + 3];

            if (tAlpha > 50) {
              const imgX = sx + tx;
              const imgY = sy + ty;
              const imgIdx = (imgY * scaledZoneW + imgX) * 4;

              const r = data[imgIdx];
              const g = data[imgIdx + 1];
              const b = data[imgIdx + 2];
              const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

              const diff = Math.abs(255 - luminance);
              sumDiff += diff;
              sumWeight += 255;
            }
          }
        }

        const score = sumWeight > 0 ? 1 - sumDiff / sumWeight : 0;
        if (score > bestScore) {
          bestScore = score;
          bestX = sx;
          bestY = sy;
        }
      }
    }

    const confidence = bestScore;
    if (confidence >= confidenceThreshold) {
      // Scale coordinates back to original full-resolution scale
      const originalBestX = Math.round(bestX / scale);
      const originalBestY = Math.round(bestY / scale);
      const originalSize = Math.round(size / scale);

      const absoluteX = zoneX + originalBestX;
      const absoluteY = zoneY + originalBestY;

      // Draw original full-resolution template for the mask
      const originalTemplateCanvas = drawGeminiLogoTemplate(originalSize, originalSize);

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = w;
      maskCanvas.height = h;
      const mCtx = maskCanvas.getContext('2d');
      if (mCtx) {
        mCtx.fillStyle = 'rgba(0,0,0,0)';
        mCtx.fillRect(0, 0, w, h);
        mCtx.drawImage(originalTemplateCanvas, absoluteX, absoluteY);
      }

      const maskImgData = mCtx ? mCtx.getImageData(0, 0, w, h) : null;

      return {
        detected: true,
        confidence,
        bbox: {
          x: absoluteX,
          y: absoluteY,
          width: originalSize,
          height: originalSize,
        },
        maskUrl: maskCanvas.toDataURL(),
        maskData: maskImgData ? maskImgData.data : undefined,
        detectorName: 'Template matching (Downscaled Acceleration)',
      };
    }
  }

  return null;
}

/**
 * Smart contour/segmentation-like detector for visible marks.
 * Accelerated by downscaling the scanning region to prevent browser freeze.
 */
export async function detectFallbackVisibleMark(
  imageElement: HTMLImageElement,
  confidenceThreshold: number
): Promise<DetectionResult> {
  const w = imageElement.naturalWidth;
  const h = imageElement.naturalHeight;

  const scanW = Math.round(w * 0.22);
  const scanH = Math.round(h * 0.15);
  const scanX = w - scanW - Math.round(w * 0.02);
  const scanY = h - scanH - Math.round(h * 0.02);

  if (scanW <= 0 || scanH <= 0 || scanX < 0 || scanY < 0) {
    return createEmergencyFallback(w, h);
  }

  // Downscale the fallback scanning region for hyper-fast execution (max dimension 300px)
  const maxDim = 300;
  const scale = Math.min(1, maxDim / Math.max(scanW, scanH));
  const scaledW = Math.round(scanW * scale);
  const scaledH = Math.round(scanH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = scaledW;
  canvas.height = scaledH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return createEmergencyFallback(w, h);
  }

  ctx.drawImage(
    imageElement,
    scanX, scanY, scanW, scanH,
    0, 0, scaledW, scaledH
  );

  const imgData = ctx.getImageData(0, 0, scaledW, scaledH);
  const data = imgData.data;

  const threshold = 180;
  const maskPoints: { x: number; y: number }[] = [];

  for (let y = 0; y < scaledH; y++) {
    for (let x = 0; x < scaledW; x++) {
      const idx = (y * scaledW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a < 50) continue;

      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const maxVal = Math.max(r, g, b);
      const minVal = Math.min(r, g, b);
      const variance = maxVal - minVal;

      if (luma > threshold && variance < 25) {
        maskPoints.push({ x, y });
      }
    }
  }

  if (maskPoints.length > 20 && maskPoints.length < (scaledW * scaledH * 0.6)) {
    let minX = scaledW;
    let maxX = 0;
    let minY = scaledH;
    let maxY = 0;

    for (const pt of maskPoints) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    const bboxWidth = maxX - minX + 1;
    const bboxHeight = maxY - minY + 1;

    if (bboxWidth > 8 && bboxHeight > 4) {
      const absX = scanX + Math.round(minX / scale);
      const absY = scanY + Math.round(minY / scale);
      const originalBboxW = Math.round(bboxWidth / scale);
      const originalBboxH = Math.round(bboxHeight / scale);

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = w;
      maskCanvas.height = h;
      const mCtx = maskCanvas.getContext('2d');
      if (mCtx) {
        mCtx.fillStyle = 'rgba(0,0,0,0)';
        mCtx.fillRect(0, 0, w, h);
        mCtx.fillStyle = 'rgba(255, 0, 0, 1)';
        
        // Draw the full-res mask matching the downscaled pixel clusters
        for (const pt of maskPoints) {
          if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
            const origX = scanX + Math.round(pt.x / scale);
            const origY = scanY + Math.round(pt.y / scale);
            const origW = Math.ceil(1 / scale);
            const origH = Math.ceil(1 / scale);
            mCtx.fillRect(origX, origY, origW, origH);
          }
        }
      }

      const maskImgData = mCtx ? mCtx.getImageData(0, 0, w, h) : null;

      return {
        detected: true,
        confidence: 0.88,
        bbox: {
          x: absX,
          y: absY,
          width: originalBboxW,
          height: originalBboxH,
        },
        maskUrl: maskCanvas.toDataURL(),
        maskData: maskImgData ? maskImgData.data : undefined,
        detectorName: 'OpenCV Fallback (Downscaled Acceleration)',
      };
    }
  }

  return createEmergencyFallback(w, h);
}

function createEmergencyFallback(w: number, h: number): DetectionResult {
  const padX = Math.round(w * 0.03);
  const padY = Math.round(h * 0.03);
  const width = Math.max(45, Math.round(w * 0.12));
  const height = Math.max(24, Math.round(h * 0.06));
  const x = w - width - padX;
  const y = h - height - padY;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const mCtx = maskCanvas.getContext('2d');
  if (mCtx) {
    mCtx.fillStyle = 'rgba(0,0,0,0)';
    mCtx.fillRect(0, 0, w, h);
    mCtx.fillStyle = 'rgba(255, 0, 0, 1)';
    mCtx.fillRect(x, y, width, height);
  }

  const maskImgData = mCtx ? mCtx.getImageData(0, 0, w, h) : null;

  return {
    detected: false,
    confidence: 0.55,
    bbox: { x, y, width, height },
    maskUrl: maskCanvas.toDataURL(),
    maskData: maskImgData ? maskImgData.data : undefined,
    detectorName: 'Fallback visible-mark detector',
  };
}

/**
 * Universal visible Gemini logo detector.
 */
export async function detectVisibleGeminiLogo(
  imageElement: HTMLImageElement,
  confidenceThreshold = 0.70
): Promise<DetectionResult> {
  try {
    const templateResult = await matchTemplate(imageElement, confidenceThreshold);
    if (templateResult && templateResult.confidence >= confidenceThreshold) {
      return templateResult;
    }

    const fallbackContrastResult = await detectFallbackVisibleMark(imageElement, confidenceThreshold);
    if (fallbackContrastResult.detected && fallbackContrastResult.confidence >= confidenceThreshold) {
      return fallbackContrastResult;
    }

    return fallbackContrastResult;
  } catch (error) {
    console.error('Detection exception:', error);
    const w = imageElement.naturalWidth;
    const h = imageElement.naturalHeight;
    const padX = Math.round(w * 0.03);
    const padY = Math.round(h * 0.03);
    const width = Math.max(45, Math.round(w * 0.12));
    const height = Math.max(24, Math.round(h * 0.06));
    const x = w - width - padX;
    const y = h - height - padY;

    return {
      detected: false,
      confidence: 0.50,
      bbox: { x, y, width, height },
      detectorName: 'Fallback visible-mark detector',
    };
  }
}
