import React from 'react';
import { QueueImage } from '../types/image';
import { Trash2, AlertCircle, CheckCircle, RefreshCw, Brush } from 'lucide-react';

interface QueueItemProps {
  item: QueueImage;
  onRemove: (id: string) => void;
  onFineTune?: (image: QueueImage) => void;
  disabled?: boolean;
}

export const QueueItem: React.FC<QueueItemProps> = ({ item, onRemove, onFineTune, disabled }) => {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: QueueImage['status']) => {
    switch (status) {
      case 'QUEUED':
        return 'text-slate-500 bg-slate-50 border-slate-200/80';
      case 'DETECTING':
      case 'MASKING':
      case 'INPAINTING':
      case 'FINALIZING':
        return 'text-violet-600 bg-violet-50 border-violet-100';
      case 'DONE':
        return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'ERROR':
        return 'text-rose-600 bg-rose-50 border-rose-100';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  return (
    <div
      id={`queue-item-${item.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-slate-100/90 bg-white p-3.5 transition-all duration-200 hover:bg-slate-50/40 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left Side: Thumbnail & File Metadata */}
        <div className="flex items-center gap-3 overflow-hidden">
          <img
            src={item.thumbnailUrl}
            alt={item.name}
            className="h-12 w-12 rounded-xl bg-slate-100 object-cover border border-slate-200/60"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-xs font-bold text-slate-900 tracking-wide" title={item.name}>
              {item.name}
            </h4>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">{formatSize(item.size)}</p>
          </div>
        </div>

        {/* Right Side: Status Chip & Action */}
        <div className="flex items-center gap-3.5">
          <span
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[9px] font-extrabold tracking-wider uppercase ${getStatusColor(
              item.status
            )}`}
          >
            {(item.status === 'DETECTING' ||
              item.status === 'MASKING' ||
              item.status === 'INPAINTING' ||
              item.status === 'FINALIZING') && (
              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
            )}
            {item.status === 'DONE' && <CheckCircle className="h-2.5 w-2.5" />}
            {item.status === 'ERROR' && <AlertCircle className="h-2.5 w-2.5" />}
            <span>{item.status}</span>
          </span>

          {onFineTune && (item.status === 'QUEUED' || item.status === 'ERROR') && (
            <button
              type="button"
              onClick={() => onFineTune(item)}
              className="text-slate-400 transition-colors hover:text-violet-600 cursor-pointer"
              title="Manual Mask Fine-Tune"
            >
              <Brush className="h-4 w-4" />
            </button>
          )}

          <button
            id={`remove-btn-${item.id}`}
            type="button"
            disabled={disabled || item.status === 'DONE'}
            onClick={() => onRemove(item.id)}
            className="text-slate-400 transition-colors hover:text-rose-500 disabled:opacity-35 disabled:hover:text-slate-400 cursor-pointer"
            aria-label="Remove image from queue"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress slider bar with violet gradient */}
      {item.status !== 'QUEUED' && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all duration-350 ease-out ${
                item.status === 'ERROR' 
                  ? 'bg-rose-500' 
                  : 'bg-gradient-to-r from-violet-500 to-indigo-500'
              }`}
              style={{ width: `${item.progress}%` }}
            />
          </div>
          {item.error && <p className="text-[10px] font-semibold text-rose-500 truncate">{item.error}</p>}
        </div>
      )}
    </div>
  );
};
