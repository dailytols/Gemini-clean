import React, { useState } from 'react';
import { QueueImage } from '../types/image';
import { downloadAllAsZip, ZipProgressCallback } from '../services/zipExporter';
import { Download, CheckCircle, RefreshCw, Trash2 } from 'lucide-react';

interface DownloadSectionProps {
  images: QueueImage[];
  onClear: () => void;
  disabled?: boolean;
}

export const DownloadSection: React.FC<DownloadSectionProps> = ({ images, onClear, disabled }) => {
  const [zipProgress, setZipProgress] = useState<ZipProgressCallback | null>(null);

  const cleanedImages = images.filter((img) => img.status === 'DONE' && img.cleanedUrl);

  const handleDownloadAll = async () => {
    if (cleanedImages.length === 0) return;

    try {
      const blob = await downloadAllAsZip(images, (progress) => {
        setZipProgress(progress);
      });

      if (blob) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `gemini-clean-${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }
    } catch (err) {
      console.error('Error generating ZIP', err);
    } finally {
      setTimeout(() => setZipProgress(null), 3000);
    }
  };

  if (cleanedImages.length === 0) return null;

  return (
    <div id="bulk-download-section" className="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-violet-100/30 flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Informative text */}
      <div className="text-center sm:text-left">
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">
          Batch Ready for Export
        </h4>
        <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
          {cleanedImages.length} of {images.length} image{images.length === 1 ? '' : 's'} cleaned successfully
        </p>
      </div>

      {/* Button controls */}
      <div className="flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
        <button
          onClick={onClear}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50/20 text-slate-500 hover:text-rose-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-4 w-4" />
          <span>Clear Queue</span>
        </button>

        <button
          onClick={handleDownloadAll}
          disabled={zipProgress !== null}
          className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] shadow-md shadow-violet-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {zipProgress ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>
                {zipProgress.status === 'PREPARING' && 'Preparing...'}
                {zipProgress.status === 'ADDING' && `Adding (${zipProgress.currentFileIndex}/${zipProgress.totalFiles})`}
                {zipProgress.status === 'COMPRESSING' && `Compressing (${zipProgress.percentage}%)`}
                {zipProgress.status === 'READY' && 'Done! Downloading'}
                {zipProgress.status === 'ERROR' && 'Export Error'}
              </span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>Download ZIP ({cleanedImages.length} Files)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
