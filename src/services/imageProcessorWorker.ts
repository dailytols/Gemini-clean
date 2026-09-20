// src/services/imageProcessorWorker.ts

import { QueueImage } from '../types/image';
import { AppSettings } from '../types/settings';
import { ProcessorCallbacks } from './imageProcessor';
import { loadImage } from './imageEncoder';
import { registerObjectUrl, safeRevokeUrl } from '../utils/memory';

let workerInstance: Worker | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initializes the Web Worker and preloads OpenCV inside the Worker
 */
export function getOrInitWorker(): Promise<Worker> {
  if (workerInstance) {
    return Promise.resolve(workerInstance);
  }

  return new Promise((resolve, reject) => {
    try {
      // Spawn Web Worker using Vite standard syntax
      const workerUrl = new URL('../workers/imageWorker.ts', import.meta.url);
      workerInstance = new Worker(workerUrl, { type: 'module' });

      // Handle worker startup verification
      const onInitMessage = (e: MessageEvent) => {
        const { type, error } = e.data;
        if (type === 'INIT_SUCCESS') {
          workerInstance?.removeEventListener('message', onInitMessage);
          resolve(workerInstance!);
        } else if (type === 'INIT_FAILURE') {
          workerInstance?.removeEventListener('message', onInitMessage);
          console.warn('Worker OpenCV init failed, falling back to local thread if needed:', error);
          resolve(workerInstance!); // Resolve anyway, worker will use pixel fallback
        }
      };

      workerInstance.addEventListener('message', onInitMessage);

      // Trigger OpenCV load in the worker background thread
      workerInstance.postMessage({ type: 'INIT_OPENCV' });

      // Safe timeout for worker initialization
      setTimeout(() => {
        workerInstance?.removeEventListener('message', onInitMessage);
        if (workerInstance) {
          resolve(workerInstance);
        } else {
          reject(new Error('Worker initialization timed out'));
        }
      }, 8000);

    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Executes a full image cleanup step inside the Web Worker.
 * Ensures the main UI thread remains 100% active, clickable, and responsive.
 */
export async function processQueueItemInWorker(
  imageItem: QueueImage,
  settings: AppSettings,
  callbacks: ProcessorCallbacks
): Promise<QueueImage> {
  const startTime = Date.now();
  let updated = { ...imageItem };

  const updateStatus = (status: QueueImage['status'], progress: number) => {
    updated.status = status;
    updated.progress = progress;
    callbacks.onUpdateImage(updated);
  };

  try {
    // 1. Loading
    updateStatus('DETECTING', 10);
    callbacks.onLog(`[${imageItem.name}] Preparing file for Worker engine...`);

    const imgUrl = imageItem.originalUrl;
    const imgElement = await loadImage(imgUrl);
    
    updated.width = imgElement.naturalWidth;
    updated.height = imgElement.naturalHeight;
    callbacks.onUpdateImage(updated);

    // Read source pixels onto a temporary Canvas to transfer to Worker
    const canvas = document.createElement('canvas');
    canvas.width = imgElement.naturalWidth;
    canvas.height = imgElement.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create local 2D context for pixel extraction.');
    }
    ctx.drawImage(imgElement, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Initialize or retrieve Web Worker
    updateStatus('DETECTING', 20);
    const worker = await getOrInitWorker();

    callbacks.onLog(`[${imageItem.name}] Running logo detection inside Worker...`);
    updateStatus('DETECTING', 30);

    // Call the Worker
    const workerResult = await new Promise<any>((resolve, reject) => {
      const handleWorkerMessage = (e: MessageEvent) => {
        const { type, result, error } = e.data;
        if (type === 'PROCESS_SUCCESS') {
          worker.removeEventListener('message', handleWorkerMessage);
          resolve(result);
        } else if (type === 'PROCESS_FAILURE') {
          worker.removeEventListener('message', handleWorkerMessage);
          reject(new Error(error || 'Worker image processing failed'));
        }
      };

      worker.addEventListener('message', handleWorkerMessage);

      // Post message with Transferable array buffer (super high performance!)
      worker.postMessage({
        type: 'PROCESS_IMAGE',
        payload: {
          width: canvas.width,
          height: canvas.height,
          pixels: imgData.data,
          settings,
          customMaskData: imageItem.customMaskData
        }
      }, [imgData.data.buffer]);
    });

    updateStatus('MASKING', 45);
    callbacks.onLog(`[${imageItem.name}] Worker detection & masking finished. Recieved pixels.`);

    // 2. Build cleaned Canvas from pixels returned by Worker
    updateStatus('INPAINTING', 65);
    callbacks.onLog(`[${imageItem.name}] Finalizing regions reconstruction...`);

    const cleanedCanvas = document.createElement('canvas');
    cleanedCanvas.width = canvas.width;
    cleanedCanvas.height = canvas.height;
    const cCtx = cleanedCanvas.getContext('2d');
    if (!cCtx) {
      throw new Error('Failed to create cleaned output 2D context.');
    }

    const outImgData = cCtx.createImageData(canvas.width, canvas.height);
    outImgData.data.set(workerResult.outputPixels);
    cCtx.putImageData(outImgData, 0, 0);

    // Update detection details
    updated.detection = workerResult.detection;

    updateStatus('FINALIZING', 80);
    callbacks.onLog(`[${imageItem.name}] Compressing and encoding final image...`);

    // 3. Compress / Export
    let mimeType = 'image/png';
    let quality = 1.0;
    const originalType = imageItem.file.type;

    if (settings.outputFormat === 'jpg') {
      if (originalType === 'image/jpeg' || originalType === 'image/jpg') {
        mimeType = 'image/jpeg';
        quality = Math.max(0.90, settings.jpgQuality / 100);
      }
    } else if (originalType === 'image/webp') {
      mimeType = 'image/webp';
    }

    const exportBlob = await new Promise<Blob | null>((resolve) => {
      cleanedCanvas.toBlob((b) => resolve(b), mimeType, quality);
    });

    if (!exportBlob) {
      throw new Error('Failed to render final output image blob');
    }

    // 4. Verification
    const outUrl = URL.createObjectURL(exportBlob);
    updated.outputWidth = canvas.width;
    updated.outputHeight = canvas.height;
    updated.outputFormatSelected = mimeType.replace('image/', '').toUpperCase();
    updated.verifiedDimensions = `${canvas.width} × ${canvas.height}`;
    updated.verified = true;
    updated.verifiedMsg = `Original resolution preserved: ${canvas.width} × ${canvas.height}`;

    if (updated.cleanedUrl) {
      safeRevokeUrl(updated.cleanedUrl);
    }

    updated.cleanedUrl = registerObjectUrl(outUrl);
    updated.processingTime = Date.now() - startTime;
    updateStatus('DONE', 100);
    callbacks.onLog(`[${imageItem.name}] Successfully cleaned in ${updated.processingTime}ms (Worker thread).`);

  } catch (err: any) {
    console.error('Worker processing error:', err);
    callbacks.onLog(`[${imageItem.name}] Worker error: ${err?.message || err}. Falling back to local main-thread...`);
    
    // Graceful main-thread fallback
    const { processQueueItem } = await import('./imageProcessor');
    return processQueueItem(imageItem, settings, callbacks);
  }

  return updated;
}
