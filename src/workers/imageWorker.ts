// src/workers/imageWorker.ts

let cvLoaded = false;
let cvLoadingPromise: Promise<any> | null = null;

// Listen to messages from the main thread
self.onmessage = async function (e: MessageEvent) {
  const { type, payload } = e.data;

  if (type === 'INIT_OPENCV') {
    try {
      await initOpenCVInWorker();
      self.postMessage({ type: 'INIT_SUCCESS' });
    } catch (err: any) {
      self.postMessage({ type: 'INIT_FAILURE', error: err?.message || err });
    }
  }

  if (type === 'PROCESS_IMAGE') {
    try {
      const result = await processImageInWorker(payload);
      self.postMessage({ type: 'PROCESS_SUCCESS', result });
    } catch (err: any) {
      self.postMessage({ type: 'PROCESS_FAILURE', error: err?.message || err });
    }
  }
};

/**
 * Loads and initializes OpenCV in the worker synchronously or asynchronously
 */
function initOpenCVInWorker(): Promise<any> {
  if (cvLoaded) return Promise.resolve();
  if (cvLoadingPromise) return cvLoadingPromise;

  cvLoadingPromise = new Promise((resolve, reject) => {
    try {
      // Load OpenCV.js inside the Web Worker using synchronous importScripts
      // This doesn't block the browser main thread at all!
      (self as any).importScripts('https://docs.opencv.org/4.5.5/opencv.js');
      
      const checkInterval = setInterval(() => {
        const cv = (self as any).cv;
        if (cv && cv.Mat) {
          clearInterval(checkInterval);
          cvLoaded = true;
          resolve(cv);
        }
      }, 100);

      // Timeout after 15 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('OpenCV.js loading in Web Worker timed out. Falling back to native pixel diffusion.'));
      }, 15000);
    } catch (err) {
      reject(new Error('Failed to importScripts OpenCV inside Web Worker: ' + err));
    }
  });

  return cvLoadingPromise;
}

/**
 * Process the image entirely in the worker
 */
async function processImageInWorker(payload: any): Promise<any> {
  const { width, height, pixels, settings, customMaskData } = payload;

  // Ensure settings defaults
  const confidenceThreshold = settings.detectionConfidence || 0.70;
  const inpaintMethod = settings.inpaintingMethod || 'telea';

  // 1. Run Watermark Detection
  let detection = await runDetectionInWorker(pixels, width, height, confidenceThreshold);

  // 2. Formulate Mask
  const maskPixels = new Uint8ClampedArray(width * height * 4);

  if (customMaskData) {
    maskPixels.set(customMaskData);
  } else if (detection.maskData) {
    maskPixels.set(detection.maskData);
  } else if (detection.bbox) {
    const { x, y, width: bw, height: bh } = detection.bbox;
    for (let my = y; my < y + bh; my++) {
      if (my < 0 || my >= height) continue;
      for (let mx = x; mx < x + bw; mx++) {
        if (mx < 0 || mx >= width) continue;
        const idx = (my * width + mx) * 4;
        maskPixels[idx] = 255;
        maskPixels[idx + 1] = 0;
        maskPixels[idx + 2] = 0;
        maskPixels[idx + 3] = 255;
      }
    }
  }

  // 3. Mask Dilation & Feathering
  const scaleFactor = Math.max(1, Math.round(Math.min(width, height) / 1000));
  const dilateRadius = 3 * scaleFactor;
  const featherRadius = 5 * scaleFactor;

  const dilated = dilateMaskInWorker(maskPixels, width, height, dilateRadius);
  const preparedMask = featherMaskInWorker(dilated, width, height, featherRadius);

  // 4. Inpainting
  let outPixels: Uint8ClampedArray;
  const cv = (self as any).cv;

  if (cv && cv.Mat && inpaintMethod !== 'auto') {
    try {
      outPixels = runOpenCVInpaintInWorker(pixels, preparedMask, width, height, inpaintMethod);
    } catch (err) {
      console.warn('Worker OpenCV inpaint failed, falling back to custom diffusion:', err);
      outPixels = runCustomDiffusionInpaintInWorker(pixels, preparedMask, width, height);
    }
  } else {
    outPixels = runCustomDiffusionInpaintInWorker(pixels, preparedMask, width, height);
  }

  // Return the output to main thread
  return {
    outputPixels: outPixels,
    detection: {
      detected: detection.detected,
      confidence: detection.confidence,
      bbox: detection.bbox,
      detectorName: detection.detectorName,
    },
    width,
    height
  };
}

/**
 * Grayscale & template matching in worker
 */
async function runDetectionInWorker(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  confidenceThreshold: number
): Promise<any> {
  const padX = Math.round(width * 0.03);
  const padY = Math.round(height * 0.03);
  const fallbackW = Math.max(45, Math.round(width * 0.12));
  const fallbackH = Math.max(24, Math.round(height * 0.06));
  const fallbackX = width - fallbackW - padX;
  const fallbackY = height - fallbackH - padY;

  // Corner scan region (bottom-right 25%)
  const brW = Math.round(width * 0.25);
  const brH = Math.round(height * 0.25);
  const zoneX = width - brW - padX;
  const zoneY = height - brH - padY;

  if (zoneX < 0 || zoneY < 0 || brW <= 0 || brH <= 0) {
    return { detected: false, confidence: 0.5, bbox: { x: fallbackX, y: fallbackY, width: fallbackW, height: fallbackH } };
  }

  // 1. High-speed template match on downscaled region
  const maxDim = 250;
  const scale = Math.min(1, maxDim / Math.max(brW, brH));
  const scaledZoneW = Math.round(brW * scale);
  const scaledZoneH = Math.round(brH * scale);

  const scaledZonePixels = new Uint8ClampedArray(scaledZoneW * scaledZoneH * 4);

  // Downscale sampling
  for (let dy = 0; dy < scaledZoneH; dy++) {
    const origY = zoneY + Math.round(dy / scale);
    if (origY >= height) continue;
    for (let dx = 0; dx < scaledZoneW; dx++) {
      const origX = zoneX + Math.round(dx / scale);
      if (origX >= width) continue;

      const srcIdx = (origY * width + origX) * 4;
      const dstIdx = (dy * scaledZoneW + dx) * 4;

      scaledZonePixels[dstIdx] = pixels[srcIdx];
      scaledZonePixels[dstIdx + 1] = pixels[srcIdx + 1];
      scaledZonePixels[dstIdx + 2] = pixels[srcIdx + 2];
      scaledZonePixels[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }

  // Template sizes
  const templateSizes = [16, 24, 32, 40];

  for (const size of templateSizes) {
    if (size > scaledZoneW || size > scaledZoneH) continue;

    const templateBytes = drawGeminiLogoTemplateWorker(size, size);
    const step = 2;
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
            const tAlpha = templateBytes[tIdx + 3];

            if (tAlpha > 50) {
              const imgX = sx + tx;
              const imgY = sy + ty;
              const imgIdx = (imgY * scaledZoneW + imgX) * 4;

              const r = scaledZonePixels[imgIdx];
              const g = scaledZonePixels[imgIdx + 1];
              const b = scaledZonePixels[imgIdx + 2];
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

    if (bestScore >= confidenceThreshold) {
      const originalBestX = Math.round(bestX / scale);
      const originalBestY = Math.round(bestY / scale);
      const originalSize = Math.round(size / scale);

      const absoluteX = zoneX + originalBestX;
      const absoluteY = zoneY + originalBestY;

      // Draw mask
      const originalTemplateBytes = drawGeminiLogoTemplateWorker(originalSize, originalSize);
      const maskData = new Uint8ClampedArray(width * height * 4);

      for (let ty = 0; ty < originalSize; ty++) {
        const globalY = absoluteY + ty;
        if (globalY < 0 || globalY >= height) continue;
        for (let tx = 0; tx < originalSize; tx++) {
          const globalX = absoluteX + tx;
          if (globalX < 0 || globalX >= width) continue;

          const tIdx = (ty * originalSize + tx) * 4;
          if (originalTemplateBytes[tIdx + 3] > 50) {
            const mIdx = (globalY * width + globalX) * 4;
            maskData[mIdx] = 255;
            maskData[mIdx + 1] = 0;
            maskData[mIdx + 2] = 0;
            maskData[mIdx + 3] = 255;
          }
        }
      }

      return {
        detected: true,
        confidence: bestScore,
        bbox: { x: absoluteX, y: absoluteY, width: originalSize, height: originalSize },
        maskData,
        detectorName: 'Template matching (Web Worker)',
      };
    }
  }

  // 2. Run Fallback scan on the worker
  const scanW = Math.round(width * 0.22);
  const scanH = Math.round(height * 0.15);
  const scanX = width - scanW - Math.round(width * 0.02);
  const scanY = height - scanH - Math.round(height * 0.02);

  const fallbackScale = Math.min(1, 300 / Math.max(scanW, scanH));
  const scaledFallbackW = Math.round(scanW * fallbackScale);
  const scaledFallbackH = Math.round(scanH * fallbackScale);

  const maskPoints: { x: number; y: number }[] = [];

  for (let y = 0; y < scaledFallbackH; y++) {
    const origY = scanY + Math.round(y / fallbackScale);
    if (origY >= height) continue;
    for (let x = 0; x < scaledFallbackW; x++) {
      const origX = scanX + Math.round(x / fallbackScale);
      if (origX >= width) continue;

      const idx = (origY * width + origX) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

      if (luminance > 180) {
        maskPoints.push({ x, y });
      }
    }
  }

  if (maskPoints.length > 20 && maskPoints.length < (scaledFallbackW * scaledFallbackH * 0.6)) {
    let minX = scaledFallbackW;
    let maxX = 0;
    let minY = scaledFallbackH;
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
      const absX = scanX + Math.round(minX / fallbackScale);
      const absY = scanY + Math.round(minY / fallbackScale);
      const originalBboxW = Math.round(bboxWidth / fallbackScale);
      const originalBboxH = Math.round(bboxHeight / fallbackScale);

      const maskData = new Uint8ClampedArray(width * height * 4);
      for (const pt of maskPoints) {
        if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
          const origX = scanX + Math.round(pt.x / fallbackScale);
          const origY = scanY + Math.round(pt.y / fallbackScale);
          const origW = Math.ceil(1 / fallbackScale);
          const origH = Math.ceil(1 / fallbackScale);

          for (let my = origY; my < origY + origH; my++) {
            if (my >= height) continue;
            for (let mx = origX; mx < origX + origW; mx++) {
              if (mx >= width) continue;
              const idx = (my * width + mx) * 4;
              maskData[idx] = 255;
              maskData[idx + 1] = 0;
              maskData[idx + 2] = 0;
              maskData[idx + 3] = 255;
            }
          }
        }
      }

      return {
        detected: true,
        confidence: 0.85,
        bbox: { x: absX, y: absY, width: originalBboxW, height: originalBboxH },
        maskData,
        detectorName: 'OpenCV Fallback (Web Worker)',
      };
    }
  }

  // Final Emergency Fallback
  const maskData = new Uint8ClampedArray(width * height * 4);
  for (let my = fallbackY; my < fallbackY + fallbackH; my++) {
    for (let mx = fallbackX; mx < fallbackX + fallbackW; mx++) {
      const idx = (my * width + mx) * 4;
      maskData[idx] = 255;
      maskData[idx + 1] = 0;
      maskData[idx + 2] = 0;
      maskData[idx + 3] = 255;
    }
  }

  return {
    detected: false,
    confidence: 0.50,
    bbox: { x: fallbackX, y: fallbackY, width: fallbackW, height: fallbackH },
    maskData,
    detectorName: 'Fallback visible-mark detector (Emergency)',
  };
}

/**
 * Draws Gemini Logo template inside Web Worker into a pixel array
 */
function drawGeminiLogoTemplateWorker(width: number, height: number): Uint8ClampedArray {
  const bytes = new Uint8ClampedArray(width * height * 4);

  const drawSparkle = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;

        // Quadratic bezier approximation of sparkle star boundary
        // x^0.5 + y^0.5 <= r^0.5
        const termX = Math.sqrt(Math.abs(dx) / rx);
        const termY = Math.sqrt(Math.abs(dy) / ry);

        if (termX + termY <= 1.0) {
          const idx = (y * width + x) * 4;
          bytes[idx] = 255;
          bytes[idx + 1] = 255;
          bytes[idx + 2] = 255;
          bytes[idx + 3] = 255;
        }
      }
    }
  };

  const mainX = width * 0.6;
  const mainY = height * 0.55;
  const mainR = Math.min(width, height) * 0.35;
  drawSparkle(mainX, mainY, mainR, mainR);

  const smallX = width * 0.25;
  const smallY = height * 0.25;
  const smallR = mainR * 0.5;
  drawSparkle(smallX, smallY, smallR, smallR);

  return bytes;
}

/**
 * Mask Dilation in Worker
 */
function dilateMaskInWorker(
  maskData: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(maskData);
  const size = width * height;
  const maskedIndices: number[] = [];

  for (let i = 0; i < size; i++) {
    if (maskData[i * 4 + 3] > 10) {
      maskedIndices.push(i);
    }
  }

  if (maskedIndices.length === 0) return output;

  for (const idx of maskedIndices) {
    const x = idx % width;
    const y = Math.floor(idx / width);

    for (let dy = -radius; dy <= radius; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;

      const maxDx = Math.floor(Math.sqrt(radius * radius - dy * dy));
      for (let dx = -maxDx; dx <= maxDx; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;

        const nIdx = (ny * width + nx) * 4;
        output[nIdx] = 255;
        output[nIdx + 1] = 0;
        output[nIdx + 2] = 0;
        output[nIdx + 3] = 255;
      }
    }
  }

  return output;
}

/**
 * Mask Feathering in Worker
 */
function featherMaskInWorker(
  maskData: Uint8ClampedArray,
  width: number,
  height: number,
  featherRadius: number
): Uint8ClampedArray {
  const output = new Uint8ClampedArray(maskData);
  const size = width * height;

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  const alphas = new Uint8Array(size);
  let hasAnyMask = false;

  for (let i = 0; i < size; i++) {
    const alpha = maskData[i * 4 + 3];
    alphas[i] = alpha;
    if (alpha > 10) {
      hasAnyMask = true;
      const x = i % width;
      const y = Math.floor(i / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (!hasAnyMask) return output;

  const pad = featherRadius + 2;
  const startX = Math.max(0, minX - pad);
  const endX = Math.min(width - 1, maxX + pad);
  const startY = Math.max(0, minY - pad);
  const endY = Math.min(height - 1, maxY + pad);

  const radius = Math.min(featherRadius, 15);

  for (let y = startY; y <= endY; y++) {
    const rowOffset = y * width;
    for (let x = startX; x <= endX; x++) {
      let sum = 0;
      let count = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          const neighborRowOffset = ny * width;
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < width) {
              sum += alphas[neighborRowOffset + nx];
              count++;
            }
          }
        }
      }

      output[(rowOffset + x) * 4 + 3] = Math.round(sum / count);
    }
  }

  return output;
}

/**
 * OpenCV inpainting inside Web Worker
 */
function runOpenCVInpaintInWorker(
  pixels: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  method: string
): Uint8ClampedArray {
  const cv = (self as any).cv;

  // Set up raw image cv.Mat elements
  const srcMat = new cv.Mat(height, width, cv.CV_8UC4);
  srcMat.data.set(pixels);

  const maskMat = new cv.Mat(height, width, cv.CV_8UC4);
  maskMat.data.set(mask);

  const maskGray = new cv.Mat();
  cv.cvtColor(maskMat, maskGray, cv.COLOR_RGBA2GRAY);

  const srcRGB = new cv.Mat();
  cv.cvtColor(srcMat, srcRGB, cv.COLOR_RGBA2RGB);

  const dstRGB = new cv.Mat();
  const cvMethod = method === 'navier-stokes' ? cv.INPAINT_NS : cv.INPAINT_TELEA;

  cv.inpaint(srcRGB, maskGray, dstRGB, 3, cvMethod);

  const dstRGBA = new cv.Mat();
  cv.cvtColor(dstRGB, dstRGBA, cv.COLOR_RGB2RGBA);

  const outputData = new Uint8ClampedArray(dstRGBA.data);

  // Clean memory leaks
  srcMat.delete();
  maskMat.delete();
  maskGray.delete();
  srcRGB.delete();
  dstRGB.delete();
  dstRGBA.delete();

  return outputData;
}

/**
 * Pixel Diffusion fallback inside Web Worker
 */
function runCustomDiffusionInpaintInWorker(
  pixels: Uint8ClampedArray,
  maskPixels: Uint8ClampedArray,
  w: number,
  h: number
): Uint8ClampedArray {
  const outputPixels = new Uint8ClampedArray(pixels);

  let minX = w, maxX = 0, minY = h, maxY = 0;
  let hasMask = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (maskPixels[idx + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        hasMask = true;
      }
    }
  }

  if (!hasMask) return outputPixels;

  minX = Math.max(0, minX - 8);
  maxX = Math.min(w - 1, maxX + 8);
  minY = Math.max(0, minY - 8);
  maxY = Math.min(h - 1, maxY + 8);

  const bboxW = maxX - minX + 1;
  const bboxH = maxY - minY + 1;

  const status = new Uint8Array(bboxW * bboxH);
  const queue: { x: number; y: number }[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const localX = x - minX;
      const localY = y - minY;
      const localIdx = localY * bboxW + localX;
      const globalIdx = (y * w + x) * 4;

      if (maskPixels[globalIdx + 3] > 10) {
        status[localIdx] = 1;
        queue.push({ x, y });
      } else {
        status[localIdx] = 0;
      }
    }
  }

  let sumR = 0, sumG = 0, sumB = 0, countSamples = 0;
  const samplePixels: { r: number; g: number; b: number }[] = [];

  for (let y = Math.max(0, minY - 15); y <= Math.min(h - 1, maxY + 15); y++) {
    for (let x = Math.max(0, minX - 15); x <= Math.min(w - 1, maxX + 15); x++) {
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        const localX = x - minX;
        const localY = y - minY;
        if (status[localY * bboxW + localX] === 1) continue;
      }

      const idx = (y * w + x) * 4;
      const r = outputPixels[idx];
      const g = outputPixels[idx + 1];
      const b = outputPixels[idx + 2];

      sumR += r;
      sumG += g;
      sumB += b;
      countSamples++;
      if (countSamples < 200) {
        samplePixels.push({ r, g, b });
      }
    }
  }

  const avgR = countSamples > 0 ? sumR / countSamples : 128;
  const avgG = countSamples > 0 ? sumG / countSamples : 128;
  const avgB = countSamples > 0 ? sumB / countSamples : 128;

  let sumSqDiff = 0;
  for (const p of samplePixels) {
    const luma = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
    const avgLuma = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
    sumSqDiff += Math.pow(luma - avgLuma, 2);
  }
  const noiseStdDev = samplePixels.length > 1 ? Math.sqrt(sumSqDiff / samplePixels.length) : 2;
  const noiseScale = Math.min(6, noiseStdDev * 0.4);

  let remaining = queue.length;
  let passes = 0;
  const maxPasses = 15;

  while (remaining > 0 && passes < maxPasses) {
    const toFillThisPass: { x: number; y: number }[] = [];

    for (let i = 0; i < queue.length; i++) {
      const pt = queue[i];
      const lx = pt.x - minX;
      const ly = pt.y - minY;
      const lIdx = ly * bboxW + lx;

      if (status[lIdx] !== 1) continue;

      let touchesSource = false;
      const neighbors = [
        { x: pt.x + 1, y: pt.y },
        { x: pt.x - 1, y: pt.y },
        { x: pt.x, y: pt.y + 1 },
        { x: pt.x, y: pt.y - 1 },
      ];

      for (const n of neighbors) {
        if (n.x >= 0 && n.x < w && n.y >= 0 && n.y < h) {
          if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) {
            const nLx = n.x - minX;
            const nLy = n.y - minY;
            if (status[nLy * bboxW + nLx] === 0 || status[nLy * bboxW + nLx] === 2) {
              touchesSource = true;
              break;
            }
          } else {
            touchesSource = true;
            break;
          }
        }
      }

      if (touchesSource) {
        toFillThisPass.push(pt);
      }
    }

    if (toFillThisPass.length === 0) break;

    for (const pt of toFillThisPass) {
      const lx = pt.x - minX;
      const ly = pt.y - minY;
      const lIdx = ly * bboxW + lx;

      let sumNR = 0, sumNG = 0, sumNB = 0, countNeighbors = 0;

      const windowSize = 2;
      for (let wy = -windowSize; wy <= windowSize; wy++) {
        const ny = pt.y + wy;
        if (ny < 0 || ny >= h) continue;

        for (let wx = -windowSize; wx <= windowSize; wx++) {
          const nx = pt.x + wx;
          if (nx < 0 || nx >= w) continue;

          if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY) {
            const nLx = nx - minX;
            const nLy = ny - minY;
            const nState = status[nLy * bboxW + nLx];
            if (nState === 1) continue; // Skip active mask pixels
          }

          const nIdx = (ny * w + nx) * 4;
          sumNR += outputPixels[nIdx];
          sumNG += outputPixels[nIdx + 1];
          sumNB += outputPixels[nIdx + 2];
          countNeighbors++;
        }
      }

      let finalR = avgR;
      let finalG = avgG;
      let finalB = avgB;

      if (countNeighbors > 0) {
        const randNoise = (Math.random() - 0.5) * noiseScale;
        finalR = Math.max(0, Math.min(255, sumNR / countNeighbors + randNoise));
        finalG = Math.max(0, Math.min(255, sumNG / countNeighbors + randNoise));
        finalB = Math.max(0, Math.min(255, sumNB / countNeighbors + randNoise));
      }

      const globalIdx = (pt.y * w + pt.x) * 4;
      outputPixels[globalIdx] = finalR;
      outputPixels[globalIdx + 1] = finalG;
      outputPixels[globalIdx + 2] = finalB;
      outputPixels[globalIdx + 3] = 255;

      status[lIdx] = 2; // Filled status
      remaining--;
    }

    passes++;
  }

  return outputPixels;
}
