import React from 'react';
import { QueueImage } from '../types/image';
import { Eye, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getCleanedFilename } from '../utils/imageUtils';

interface ResultCardProps {
  image: QueueImage;
  onCompare: (image: QueueImage) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ image, onCompare }) => {
  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!image.cleanedUrl) return;

    const link = document.createElement('a');
    link.href = image.cleanedUrl;
    link.download = getCleanedFilename(image.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      id={`result-card-${image.id}`}
      className="group relative flex flex-col overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-md transition-all duration-300 hover:shadow-xl hover:shadow-violet-100/30 hover:scale-[1.01]"
    >
      {/* Visual Workspace Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
        <img
          src={image.cleanedUrl || image.originalUrl}
          alt={image.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />

        {/* Hover overlay with Compare action */}
        {image.cleanedUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 backdrop-blur-[2px] transition-all duration-200 group-hover:opacity-100">
            <button
              onClick={() => onCompare(image)}
              className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-violet-50 hover:text-violet-600 text-slate-900 px-4.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-lg cursor-pointer hover:scale-[1.02]"
            >
              <Eye className="h-4 w-4" />
              <span>Compare BEFORE/AFTER</span>
            </button>
          </div>
        )}

        {/* Status indicator on corner */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {image.verified ? (
            <span className="flex items-center gap-1 rounded-lg bg-emerald-500/90 backdrop-blur-[2px] px-2 py-0.5 text-[9px] font-black tracking-wider text-white uppercase shadow-sm">
              <CheckCircle2 className="h-3 w-3" />
              <span>Lossless Res</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-lg bg-orange-500/90 backdrop-blur-[2px] px-2 py-0.5 text-[9px] font-black tracking-wider text-white uppercase shadow-sm">
              <AlertTriangle className="h-3 w-3" />
              <span>Modified</span>
            </span>
          )}
        </div>
      </div>

      {/* Metadata Bottom Card */}
      <div className="flex flex-col flex-grow p-4.5">
        <h4 className="truncate text-xs font-bold text-slate-900 tracking-wide" title={image.name}>
          {image.name}
        </h4>
        
        {/* Dimensions verification label */}
        <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
          <span>{image.verifiedDimensions || `${image.width || 0} × ${image.height || 0}`}</span>
          <span className="text-slate-300">•</span>
          <span className="text-violet-600">{image.outputFormatSelected || 'PNG'}</span>
        </p>

        {image.processingTime && (
          <p className="mt-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
            Processed in <span className="text-slate-700">{image.processingTime}ms</span>
          </p>
        )}

        {/* Action button bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2.5">
          <button
            onClick={() => onCompare(image)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 py-2 text-xs font-bold transition-all cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Compare</span>
          </button>

          {image.cleanedUrl && (
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-1 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 text-xs font-bold transition-all hover:scale-[1.02] shadow-md shadow-violet-150 cursor-pointer"
              aria-label="Download Cleaned Image"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
