import { InpaintingMethod } from '../types/settings';

let isCvLoading = false;

/**
 * Loads OpenCV.js dynamically into the document.
 */
export function loadOpenCV(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).cv) {
      resolve((window as any).cv);
      return;
    }

    if (isCvLoading) {
      const interval = setInterval(() => {
        if ((window as any).cv) {
          clearInterval(interval);
          resolve((window as any).cv);
        }
      }, 100);
      return;
    }

    isCvLoading = true;
    const script = document.createElement('script');
    script.setAttribute('id', 'opencv-js');
    script.src = 'https://docs.opencv.org/4.5.5/opencv.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).cv && (window as any).cv.onRuntimeInitialized) {
        (window as any).cv.onRuntimeInitialized = () => {
          resolve((window as any).cv);
        };
      } else {
        let count = 0;
        const checkInit = setInterval(() => {
          if ((window as any).cv && (window as any).cv.Mat) {
            clearInterval(checkInit);
            resolve((window as any).cv);
          }
          if (count++ > 50) {
            clearInterval(checkInit);
            reject(new Error('OpenCV failed to initialize in time.'));
          }
        }, 150);
      }
    };
    script.onerror = () => {
      isCvLoading = false;
      reject(new Error('Failed to load OpenCV.js from CDN.'));
    };
    document.body.appendChild(script);
  });
}

/**
 * Core Inpainting orchestrator.
 */
export async function runInpaint(
  imageCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  method: InpaintingMethod
): Promise<HTMLCanvasElement> {
  const w = imageCanvas.width;
  const h = imageCanvas.height;

  const cv = (window as any).cv;
  if (cv && cv.Mat && method !== 'auto') {
    try {
      console.log(`Running OpenCV.js Inpainting (${method})...`);
      const src = cv.imread(imageCanvas);
      const mask = cv.imread(maskCanvas);
      const maskGray = new cv.Mat();
      cv.cvtColor(mask, maskGray, cv.COLOR_RGBA2GRAY);

      const M = cv.Mat.ones(3, 3, cv.CV_8U);
      const dilatedMask = new cv.Mat();
      cv.dilate(maskGray, dilatedMask, M);

      const dst = new cv.Mat();
      const inpaintMethod = method === 'navier-stokes' ? cv.INPAINT_NS : cv.INPAINT_TELEA;
      
      cv.inpaint(src, dilatedMask, dst, 3, inpaintMethod);

      const resultCanvas = document.createElement('canvas');
      resultCanvas.width = w;
      resultCanvas.height = h;
      cv.imshow(resultCanvas, dst);

      src.delete();
      mask.delete();
      maskGray.delete();
      M.delete();
      dilatedMask.delete();
      dst.delete();

      return resultCanvas;
    } catch (e) {
      console.warn('OpenCV inpainting failed, falling back to custom high-quality diffusion:', e);
    }
  }

  return runCustomDiffusionInpaint(imageCanvas, maskCanvas);
}

/**
 * Custom pixel-diffusion & noise-matching inpainter.
 */
function runCustomDiffusionInpaint(
  imageCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement
): HTMLCanvasElement {
  const w = imageCanvas.width;
  const h = imageCanvas.height;

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = w;
  resultCanvas.height = h;

  const rCtx = resultCanvas.getContext('2d');
  const mCtx = maskCanvas.getContext('2d');
  const iCtx = imageCanvas.getContext('2d');
  if (!rCtx || !mCtx || !iCtx) return imageCanvas;

  rCtx.drawImage(imageCanvas, 0, 0);

  const imgData = rCtx.getImageData(0, 0, w, h);
  const maskData = mCtx.getImageData(0, 0, w, h);

  const pixels = imgData.data;
  const maskPixels = maskData.data;

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

  if (!hasMask) return resultCanvas;

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
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

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

    if (toFillThisPass.length === 0) {
      for (const pt of queue) {
        const lx = pt.x - minX;
        const ly = pt.y - minY;
        const lIdx = ly * bboxW + lx;
        if (status[lIdx] === 1) {
          const gIdx = (pt.y * w + pt.x) * 4;
          pixels[gIdx] = avgR;
          pixels[gIdx + 1] = avgG;
          pixels[gIdx + 2] = avgB;
          status[lIdx] = 2;
        }
      }
      break;
    }

    for (const pt of toFillThisPass) {
      const lx = pt.x - minX;
      const ly = pt.y - minY;
      const lIdx = ly * bboxW + lx;

      let rSum = 0, gSum = 0, bSum = 0, weightSum = 0;
      const searchRadius = 3;

      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const ny = pt.y + dy;
        if (ny < 0 || ny >= h) continue;

        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
          const nx = pt.x + dx;
          if (nx < 0 || nx >= w) continue;

          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > searchRadius) continue;

          let isPixelSource = true;
          if (nx >= minX && nx <= maxX && ny >= minY && ny <= maxY) {
            const nLx = nx - minX;
            const nLy = ny - minY;
            const nStatus = status[nLy * bboxW + nLx];
            if (nStatus === 1) isPixelSource = false;
          }

          if (isPixelSource) {
            const nGIdx = (ny * w + nx) * 4;
            const spatialWeight = 1 / (dist + 0.5);

            rSum += pixels[nGIdx] * spatialWeight;
            gSum += pixels[nGIdx + 1] * spatialWeight;
            bSum += pixels[nGIdx + 2] * spatialWeight;
            weightSum += spatialWeight;
          }
        }
      }

      const gIdx = (pt.y * w + pt.x) * 4;
      if (weightSum > 0) {
        pixels[gIdx] = Math.round(rSum / weightSum);
        pixels[gIdx + 1] = Math.round(gSum / weightSum);
        pixels[gIdx + 2] = Math.round(bSum / weightSum);
      } else {
        pixels[gIdx] = avgR;
        pixels[gIdx + 1] = avgG;
        pixels[gIdx + 2] = avgB;
      }

      status[lIdx] = 2;
      remaining--;
    }

    passes++;
  }

  const blurRadius = 2;
  const tempPixels = new Uint8ClampedArray(pixels);

  for (const pt of queue) {
    let rSum = 0, gSum = 0, bSum = 0, wSum = 0;

    for (let dy = -blurRadius; dy <= blurRadius; dy++) {
      const ny = pt.y + dy;
      if (ny < 0 || ny >= h) continue;

      for (let dx = -blurRadius; dx <= blurRadius; dx++) {
        const nx = pt.x + dx;
        if (nx < 0 || nx >= w) continue;

        const gIdx = (ny * w + nx) * 4;
        const kernelWeight = 1 / (1 + dx * dx + dy * dy);

        rSum += tempPixels[gIdx] * kernelWeight;
        gSum += tempPixels[gIdx + 1] * kernelWeight;
        bSum += tempPixels[gIdx + 2] * kernelWeight;
        wSum += kernelWeight;
      }
    }

    if (wSum > 0) {
      const gIdx = (pt.y * w + pt.x) * 4;
      const noise = (Math.random() - 0.5) * noiseScale;

      pixels[gIdx] = Math.max(0, Math.min(255, Math.round(rSum / wSum + noise)));
      pixels[gIdx + 1] = Math.max(0, Math.min(255, Math.round(gSum / wSum + noise)));
      pixels[gIdx + 2] = Math.max(0, Math.min(255, Math.round(bSum / wSum + noise)));
    }
  }

  rCtx.putImageData(imgData, 0, 0);
  return resultCanvas;
}
