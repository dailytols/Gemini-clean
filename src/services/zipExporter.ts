import JSZip from 'jszip';
import { QueueImage } from '../types/image';
import { getCleanedFilename, getUniqueFilename } from '../utils/imageUtils';

export interface ZipProgressCallback {
  status: 'PREPARING' | 'ADDING' | 'COMPRESSING' | 'READY' | 'ERROR';
  currentFileIndex?: number;
  totalFiles?: number;
  percentage?: number;
}

/**
 * Downloads all successfully cleaned images as a single, compiled ZIP file.
 */
export async function downloadAllAsZip(
  images: QueueImage[],
  onProgress: (progress: ZipProgressCallback) => void
): Promise<Blob | null> {
  onProgress({ status: 'PREPARING', percentage: 0 });

  const cleanedImages = images.filter((img) => img.status === 'DONE' && img.cleanedUrl);
  if (cleanedImages.length === 0) {
    onProgress({ status: 'ERROR' });
    throw new Error('No successfully cleaned images available to export.');
  }

  const zip = new JSZip();
  const folder = zip.folder('gemini-clean');
  if (!folder) {
    onProgress({ status: 'ERROR' });
    throw new Error('Failed to create folder inside ZIP.');
  }

  const usedFilenames = new Set<string>();

  try {
    for (let i = 0; i < cleanedImages.length; i++) {
      const imgItem = cleanedImages[i];
      onProgress({
        status: 'ADDING',
        currentFileIndex: i + 1,
        totalFiles: cleanedImages.length,
        percentage: Math.round(((i + 1) / cleanedImages.length) * 40),
      });

      if (!imgItem.cleanedUrl) continue;

      const response = await fetch(imgItem.cleanedUrl);
      const blob = await response.blob();

      const initialName = getCleanedFilename(imgItem.name);
      const uniqueName = getUniqueFilename(initialName, usedFilenames);
      usedFilenames.add(uniqueName);

      folder.file(uniqueName, blob);
    }

    onProgress({ status: 'COMPRESSING', percentage: 75 });

    const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      onProgress({
        status: 'COMPRESSING',
        percentage: Math.min(99, 75 + Math.round(metadata.percent * 0.24)),
      });
    });

    onProgress({ status: 'READY', percentage: 100 });
    return zipBlob;
  } catch (error) {
    console.error('Error generating ZIP:', error);
    onProgress({ status: 'ERROR' });
    return null;
  }
}
