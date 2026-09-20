import { useState, useCallback, useRef } from 'react';
import { QueueImage } from '../types/image';
import { AppSettings } from '../types/settings';
import { processQueueItem } from '../services/imageProcessor';

export function useImageProcessor(
  images: QueueImage[],
  updateImage: (updated: QueueImage) => void,
  settings: AppSettings
) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const cancelRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const cancelProcessing = useCallback(() => {
    cancelRef.current = true;
    setIsProcessing(false);
    addLog('Queue processing cancelled by user.');
  }, [addLog]);

  const startProcessing = useCallback(async () => {
    if (images.length === 0 || isProcessing) return;

    setIsProcessing(true);
    cancelRef.current = false;
    clearLogs();
    addLog('Starting queue processing engine...');
    addLog(`Processing Mode: ${settings.processingMode.toUpperCase()}`);
    addLog(`Inpainting Method: ${settings.inpaintingMethod.toUpperCase()}`);

    const targetImages = images.filter((img) => img.status === 'QUEUED' || img.status === 'ERROR');

    if (targetImages.length === 0) {
      addLog('No images in QUEUED or ERROR status. Resetting statuses first.');
      setIsProcessing(false);
      return;
    }

    let countProcessed = 0;
    
    for (let i = 0; i < images.length; i++) {
      if (cancelRef.current) {
        break;
      }

      const img = images[i];
      if (img.status !== 'QUEUED' && img.status !== 'ERROR') {
        continue;
      }

      setCurrentIndex(i + 1);
      addLog(`Processing image ${i + 1} of ${images.length}: ${img.name}`);

      try {
        await processQueueItem(img, settings, {
          onUpdateImage: updateImage,
          onOverallProgress: () => {},
          onLog: addLog,
        });
        countProcessed++;
      } catch (err: any) {
        addLog(`Failed to process ${img.name}: ${err?.message || err}`);
      }

      await new Promise((r) => setTimeout(r, 150));
    }

    setIsProcessing(false);
    if (cancelRef.current) {
      addLog('Queue processing stopped.');
    } else {
      addLog(`Finished batch processing. Success rate: ${countProcessed}/${targetImages.length}`);
    }
  }, [images, isProcessing, updateImage, settings, addLog, clearLogs]);

  return {
    isProcessing,
    currentIndex,
    logs,
    startProcessing,
    cancelProcessing,
    clearLogs,
  };
}
