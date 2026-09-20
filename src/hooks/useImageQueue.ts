import { useState, useCallback, useMemo } from 'react';
import { QueueImage } from '../types/image';
import { createThumbnail } from '../utils/imageUtils';
import { safeRevokeUrl } from '../utils/memory';
import { validateImageFile } from '../utils/validation';

export function useImageQueue() {
  const [images, setImages] = useState<QueueImage[]>([]);
  const [maxBatchSize, setMaxBatchSize] = useState<number>(5);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const clearQueue = useCallback(() => {
    images.forEach((img) => {
      safeRevokeUrl(img.originalUrl);
      safeRevokeUrl(img.cleanedUrl);
      safeRevokeUrl(img.thumbnailUrl);
    });
    setImages([]);
    setErrorMsg(null);
  }, [images]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) {
        safeRevokeUrl(target.originalUrl);
        safeRevokeUrl(target.cleanedUrl);
        safeRevokeUrl(target.thumbnailUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      setErrorMsg(null);

      const validFiles: File[] = [];
      let rejectedMsg: string | null = null;

      for (const f of files) {
        const validation = validateImageFile(f);
        if (validation.valid) {
          validFiles.push(f);
        } else {
          rejectedMsg = validation.error || 'Invalid file detected.';
        }
      }

      if (rejectedMsg) {
        setErrorMsg(rejectedMsg);
      }

      const incomingTotal = images.length + validFiles.length;

      if (incomingTotal > maxBatchSize) {
        setErrorMsg(`Maximum limit of ${maxBatchSize} images exceeded for this batch.`);
        const allowedCount = maxBatchSize - images.length;
        if (allowedCount <= 0) return;
        validFiles.splice(allowedCount);
      }

      const newItems: QueueImage[] = [];

      for (const file of validFiles) {
        const id = Math.random().toString(36).substring(2, 9);
        const originalUrl = URL.createObjectURL(file);
        const thumbnailUrl = await createThumbnail(file);

        newItems.push({
          id,
          file,
          name: file.name,
          size: file.size,
          originalUrl,
          thumbnailUrl: thumbnailUrl || originalUrl,
          status: 'QUEUED',
          progress: 0,
        });
      }

      setImages((prev) => [...prev, ...newItems]);
    },
    [images, maxBatchSize]
  );

  const updateImage = useCallback((updated: QueueImage) => {
    setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
  }, []);

  const overallProgress = useMemo(() => {
    if (images.length === 0) return 0;
    const totalProgress = images.reduce((acc, img) => acc + img.progress, 0);
    return Math.round(totalProgress / images.length);
  }, [images]);

  const queueFinished = useMemo(() => {
    if (images.length === 0) return false;
    return images.every((img) => img.status === 'DONE' || img.status === 'ERROR');
  }, [images]);

  return {
    images,
    setImages,
    maxBatchSize,
    setMaxBatchSize,
    errorMsg,
    setErrorMsg,
    addFiles,
    removeImage,
    clearQueue,
    updateImage,
    overallProgress,
    queueFinished,
  };
}
