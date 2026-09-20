import { QueueImage } from '../types/image';
import { AppSettings } from '../types/settings';
import { detectVisibleGeminiLogo } from './watermarkDetector';
import { runInpaint } from './inpainting';
import { dilateMask, featherMask, loadImage } from './imageEncoder';
import { registerObjectUrl, safeRevokeUrl } from '../utils/memory';

export interface ProcessorCallbacks {
  onUpdateImage: (updated: QueueImage) => void;
  onOverallProgress: (progress: number) => void;
  onLog: (msg: string) => void;
}

/**
 * High-performance, non-blocking queue processor.
 */
export async function processQueueItem(
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
    // Stage 1: Loading
    updateStatus('DETECTING', 10);
    callbacks.onLog(`[${imageItem.name}] Loading image file...`);
    
    const imgUrl = imageItem.originalUrl;
    const imgElement = await loadImage(imgUrl);
    updated.width = imgElement.naturalWidth;
    updated.height = imgElement.naturalHeight;
    callbacks.onUpdateImage(updated);

    await new Promise((r) => setTimeout(r, 80));

    // Stage 2: Logo Detection
    callbacks.onLog(`[${imageItem.name}] Running logo detection...`);
    const detection = await detectVisibleGeminiLogo(imgElement, settings.detectionConfidence);
    updated.detection = detection;
    updateStatus('MASKING', 35);
    callbacks.onLog(`[${imageItem.name}] Detection finished (${detection.detectorName}, confidence: ${detection.confidence.toFixed(2)}).`);

    await new Promise((r) => setTimeout(r, 80));

    // Stage 3: Mask Preparation
    callbacks.onLog(`[${imageItem.name}] Preparing inpainting masks...`);
    const mainCanvas = document.createElement('canvas');
    mainCanvas.width = imgElement.naturalWidth;
    mainCanvas.height = imgElement.naturalHeight;
    const mCtx = mainCanvas.getContext('2d');
    if (mCtx) {
      mCtx.drawImage(imgElement, 0, 0);
    }

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = imgElement.naturalWidth;
    maskCanvas.height = imgElement.naturalHeight;
    const maskCtx = maskCanvas.getContext('2d');

    if (maskCtx) {
      if (imageItem.customMaskData) {
        const imgData = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
        imgData.data.set(imageItem.customMaskData);
        maskCtx.putImageData(imgData, 0, 0);
        callbacks.onLog(`[${imageItem.name}] Utilizing custom-tuned user mask.`);
      } else if (detection.maskData) {
        const imgData = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
        imgData.data.set(detection.maskData);
        maskCtx.putImageData(imgData, 0, 0);
      } else if (detection.bbox) {
        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.fillStyle = 'white';
        const { x, y, width, height } = detection.bbox;
        maskCtx.fillRect(x, y, width, height);
      }
    }

    if (maskCtx) {
      const originalMaskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const scaleFactor = Math.max(1, Math.round(Math.min(imgElement.naturalWidth, imgElement.naturalHeight) / 1000));
      const dilateRadius = 3 * scaleFactor;
      const featherRadius = 5 * scaleFactor;

      const dilated = dilateMask(originalMaskData.data, maskCanvas.width, maskCanvas.height, dilateRadius);
      const feathered = featherMask(dilated, maskCanvas.width, maskCanvas.height, featherRadius);

      const featheredImgData = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
      featheredImgData.data.set(feathered);
      maskCtx.putImageData(featheredImgData, 0, 0);
    }

    updateStatus('INPAINTING', 55);
    await new Promise((r) => setTimeout(r, 80));

    // Stage 4: Inpainting
    callbacks.onLog(`[${imageItem.name}] Reconstructing regions...`);
    const cleanedCanvas = await runInpaint(mainCanvas, maskCanvas, settings.inpaintingMethod);

    updateStatus('FINALIZING', 80);
    callbacks.onLog(`[${imageItem.name}] Finalizing output encoding...`);

    // Stage 5: Export compression
    let mimeType = 'image/png';
    let extension = 'png';
    let quality = 1.0;
    
    const originalType = imageItem.file.type;
    
    if (settings.outputFormat === 'jpg') {
      if (originalType === 'image/jpeg' || originalType === 'image/jpg') {
        mimeType = 'image/jpeg';
        extension = 'jpg';
        quality = Math.max(0.90, settings.jpgQuality / 100);
      } else {
        mimeType = 'image/png';
        extension = 'png';
        quality = 1.0;
      }
    } else if (originalType === 'image/webp') {
      mimeType = 'image/webp';
      extension = 'webp';
      quality = 1.0;
    } else {
      mimeType = 'image/png';
      extension = 'png';
      quality = 1.0;
    }

    callbacks.onLog(`[${imageItem.name}] Rendering final image in format: ${mimeType} (quality: ${quality})`);

    const exportBlob = await new Promise<Blob | null>((resolve) => {
      cleanedCanvas.toBlob((b) => resolve(b), mimeType, quality);
    });

    if (!exportBlob) {
      throw new Error('Failed to render final output image blob');
    }

    // Stage 6: Resolution Verification
    const tempUrl = URL.createObjectURL(exportBlob);
    const outputImgElement = await loadImage(tempUrl);
    const inputWidth = imgElement.naturalWidth;
    const inputHeight = imgElement.naturalHeight;
    const outputWidth = outputImgElement.naturalWidth;
    const outputHeight = outputImgElement.naturalHeight;
    URL.revokeObjectURL(tempUrl);

    const isDimensionVerified = (inputWidth === outputWidth) && (inputHeight === outputHeight);
    
    updated.verified = isDimensionVerified;
    updated.outputWidth = outputWidth;
    updated.outputHeight = outputHeight;
    updated.outputFormatSelected = mimeType.replace('image/', '').toUpperCase();
    updated.verifiedDimensions = `${outputWidth} × ${outputHeight}`;

    if (isDimensionVerified) {
      updated.verifiedMsg = `Original resolution preserved: ${inputWidth} × ${inputHeight}`;
      callbacks.onLog(`[${imageItem.name}] Dimension Verification Success! Input: ${inputWidth}x${inputHeight} === Output: ${outputWidth}x${outputHeight}.`);
    } else {
      updated.verifiedMsg = `Warning: Resolution Mismatch! Original: ${inputWidth}x${inputHeight}, Output: ${outputWidth}x${outputHeight}`;
      callbacks.onLog(`[${imageItem.name}] Warning: Mismatched output dimensions!`);
    }

    if (updated.cleanedUrl) {
      safeRevokeUrl(updated.cleanedUrl);
    }

    updated.cleanedUrl = registerObjectUrl(URL.createObjectURL(exportBlob));
    updated.processingTime = Date.now() - startTime;
    updateStatus('DONE', 100);
    callbacks.onLog(`[${imageItem.name}] Completed cleaning in ${updated.processingTime}ms.`);

  } catch (err: any) {
    console.error('Processing error:', err);
    updated.status = 'ERROR';
    updated.progress = 100;
    updated.error = err?.message || 'Error occurred during cleaning';
    callbacks.onUpdateImage(updated);
    callbacks.onLog(`[${imageItem.name}] Error: ${updated.error}`);
  }

  return updated;
}
