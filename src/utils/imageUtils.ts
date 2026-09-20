import { registerObjectUrl } from './memory';

/**
 * Loads an image URL into an HTMLImageElement
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
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
 * Dilates a binary mask.
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
  
  const isMasked = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    isMasked[i] = maskData[i * 4 + 3] > 10 ? 1 : 0;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (isMasked[idx] === 1) continue;

      let found = false;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        
        const maxDx = Math.floor(Math.sqrt(radius * radius - dy * dy));
        
        for (let dx = -maxDx; dx <= maxDx; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          
          if (isMasked[ny * width + nx] === 1) {
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (found) {
        const targetIdx = idx * 4;
        output[targetIdx] = 255;
        output[targetIdx + 1] = 0;
        output[targetIdx + 2] = 0;
        output[targetIdx + 3] = 255;
      }
    }
  }

  return output;
}

/**
 * Softens/feathers a binary mask.
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
  
  const alphas = new Uint8Array(size);
  const blurredAlphas = new Uint8Array(size);
  
  for (let i = 0; i < size; i++) {
    alphas[i] = maskData[i * 4 + 3];
  }

  const radius = Math.min(featherRadius, 15);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < width) {
              sum += alphas[ny * width + nx];
              count++;
            }
          }
        }
      }
      blurredAlphas[y * width + x] = Math.round(sum / count);
    }
  }

  for (let i = 0; i < size; i++) {
    output[i * 4 + 3] = blurredAlphas[i];
  }

  return output;
}

/**
 * Safely adds a suffix to a filename before the extension.
 */
export function getCleanedFilename(originalName: string, suffix = '_clean'): string {
  const lastDotIndex = originalName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return `${originalName}${suffix}.png`;
  }
  const name = originalName.substring(0, lastDotIndex);
  const ext = originalName.substring(lastDotIndex);
  
  const safeName = name.replace(/[^a-zA-Z0-9_\- ]/g, '');
  return `${safeName}${suffix}${ext}`;
}

/**
 * Ensures unique filenames in a list of existing names.
 */
export function getUniqueFilename(filename: string, existingNames: Set<string>): string {
  const lastDotIndex = filename.lastIndexOf('.');
  const baseName = lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
  const ext = lastDotIndex === -1 ? '' : filename.substring(lastDotIndex);

  let candidate = filename;
  let counter = 1;

  while (existingNames.has(candidate)) {
    candidate = `${baseName}_(${counter})${ext}`;
    counter++;
  }

  return candidate;
}
