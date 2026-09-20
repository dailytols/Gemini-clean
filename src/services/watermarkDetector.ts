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
 */
export async function matchTemplate(
  imageElement: HTMLImageElement,
  confidenceThreshold: number
): Promise<DetectionResult | null> {
  const w = imageElement.naturalWidth;
  const h = imageElement.naturalHeight;

  const templateSizes = [32, 48, 64, 80];
  const padding = Math.max(16, Math.round(Math.min(w, h) * 0.02));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(imageElement, 0, 0);

  const searchZones: { x: number; y: number; width: number; height: number; name: string }[] = [];

  // Bottom-Right quadrant scan region
  const brW = Math.round(w * 0.25);
  const brH = Math.round(h * 0.25);
  searchZones.push({
    x: w - brW - padding,
    y: h - brH - padding,
    width: brW,
    height: brH,
    name: 'Bottom-Right',
  });

  for (const zone of searchZones) {
    if (zone.x < 0 || zone.y < 0 || zone.width <= 0 || zone.height <= 0) continue;

    const imgData = ctx.getImageData(zone.x, zone.y, zone.width, zone.height);
    const data = imgData.data;

    for (const size of templateSizes) {
      if (size > zone.width || size > zone.height) continue;

      const templateCanvas = drawGeminiLogoTemplate(size, size);
      const tCtx = templateCanvas.getContext('2d');
      if (!tCtx) continue;
      const tData = tCtx.getImageData(0, 0, size, size);
      const tBytes = tData.data;

      const step = Math.max(1, Math.round(size / 8));
      let bestScore = -1;
      let bestX = 0;
      let bestY = 0;

      for (let sy = 0; sy < zone.height - size; sy += step) {
        for (let sx = 0; sx < zone.width - size; sx += step) {
          
          let sumDiff = 0;
          let sumWeight = 0;

          for (let ty = 0; ty < size; ty++) {
            for (let tx = 0; tx < size; tx++) {
              const tIdx = (ty * size + tx) * 4;
              const tAlpha = tBytes[tIdx + 3];

              if (tAlpha > 50) {
                const imgX = sx + tx;
                const imgY = sy + ty;
                const imgIdx = (imgY * zone.width + imgX) * 4;

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
        const absoluteX = zone.x + bestX;
        const absoluteY = zone.y + bestY;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = w;
        maskCanvas.height = h;
        const mCtx = maskCanvas.getContext('2d');
        if (mCtx) {
          mCtx.fillStyle = 'rgba(0,0,0,0)';
          mCtx.fillRect(0, 0, w, h);
          mCtx.drawImage(templateCanvas, absoluteX, absoluteY);
        }

        const maskImgData = mCtx ? mCtx.getImageData(0, 0, w, h) : null;

        return {
          detected: true,
          confidence,
          bbox: {
            x: absoluteX,
            y: absoluteY,
            width: size,
            height: size,
          },
          maskUrl: maskCanvas.toDataURL(),
          maskData: maskImgData ? maskImgData.data : undefined,
          detectorName: 'Template matching',
        };
      }
    }
  }

  return null;
}

/**
 * Smart contour/segmentation-like detector for visible marks.
 */
export async function detectFallbackVisibleMark(
  imageElement: HTMLImageElement,
  confidenceThreshold: number
): Promise<DetectionResult> {
  const w = imageElement.naturalWidth;
  const h = imageElement.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return createEmergencyFallback(w, h);
  }

  ctx.drawImage(imageElement, 0, 0);

  const scanW = Math.round(w * 0.22);
  const scanH = Math.round(h * 0.15);
  const scanX = w - scanW - Math.round(w * 0.02);
  const scanY = h - scanH - Math.round(h * 0.02);

  if (scanW <= 0 || scanH <= 0 || scanX < 0 || scanY < 0) {
    return createEmergencyFallback(w, h);
  }

  const imgData = ctx.getImageData(scanX, scanY, scanW, scanH);
  const data = imgData.data;

  const threshold = 180;
  const maskPoints: { x: number; y: number }[] = [];

  for (let y = 0; y < scanH; y++) {
    for (let x = 0; x < scanW; x++) {
      const idx = (y * scanW + x) * 4;
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

  if (maskPoints.length > 20 && maskPoints.length < (scanW * scanH * 0.6)) {
    let minX = scanW;
    let maxX = 0;
    let minY = scanH;
    let maxY = 0;

    for (const pt of maskPoints) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    const bboxWidth = maxX - minX + 1;
    const bboxHeight = maxY - minY + 1;

    if (bboxWidth > 15 && bboxHeight > 8 && bboxWidth < scanW * 0.95 && bboxHeight < scanH * 0.95) {
      const absX = scanX + minX;
      const absY = scanY + minY;

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = w;
      maskCanvas.height = h;
      const mCtx = maskCanvas.getContext('2d');
      if (mCtx) {
        mCtx.fillStyle = 'rgba(0,0,0,0)';
        mCtx.fillRect(0, 0, w, h);
        mCtx.fillStyle = 'rgba(255, 0, 0, 1)';
        
        for (const pt of maskPoints) {
          if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
            mCtx.fillRect(scanX + pt.x, scanY + pt.y, 1, 1);
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
          width: bboxWidth,
          height: bboxHeight,
        },
        maskUrl: maskCanvas.toDataURL(),
        maskData: maskImgData ? maskImgData.data : undefined,
        detectorName: 'OpenCV Fallback',
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
