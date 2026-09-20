import { registerObjectUrl } from '../utils/memory';

/**
 * Loads an image URL into an HTMLImageElement safely
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Only set crossOrigin if loading from an external http/https URL to avoid CORS or block on local blobs
    if (url.startsWith('http') && !url.startsWith(window.location.origin)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = url;
  });
}

/**
 * Creates a low-res thumbnail Object URL for rapid rendering list preview
 */
export async function createThumbnail(file: File, maxDim = 120): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    URL.revokeObjectURL(url);
    if (blob) {
      return registerObjectUrl(URL.createObjectURL(blob));
    }
    return '';
  } catch (err) {
    URL.revokeObjectURL(url);
    console.warn('Failed to make thumbnail', err);
    return '';
  }
}

/**
 * Dilates a binary mask of size width * height by a specific radius (in pixels)
 * Hyper-optimized by only spreading outwards from known masked pixels.
 */
export function dilateMask(
  maskData: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  if (radius <= 0) return new Uint8ClampedArray(maskData);
  
  const output = new Uint8ClampedArray(maskData);
  const size = width * height;
  
  // Find all masked pixel indices first (alpha > 10)
  const maskedIndices: number[] = [];
  for (let i = 0; i < size; i++) {
    if (maskData[i * 4 + 3] > 10) {
      maskedIndices.push(i);
    }
  }

  // If no masked pixels exist, return the original
  if (maskedIndices.length === 0) {
    return output;
  }

  // Expand outwards from each masked pixel index
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
 * Softens/feathers a binary mask using a box blur.
 * Hyper-optimized to execute ONLY inside the mask's local bounding box region.
 */
export function featherMask(
  maskData: Uint8ClampedArray,
  width: number,
  height: number,
  featherRadius: number
): Uint8ClampedArray {
  if (featherRadius <= 0) return maskData;

  const output = new Uint8ClampedArray(maskData);
  const size = width * height;
  
  // Find local bounding box of the active mask region
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
  
  if (!hasAnyMask) {
    return output;
  }
  
  // Pad the bounding box slightly to capture the entire feathered falloff
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
