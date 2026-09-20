import React from 'react';
import { BATCH_SIZES } from '../utils/constants';

interface BatchSelectorProps {
  maxBatchSize: number;
  onSelectSize: (size: number) => void;
  disabled?: boolean;
}

export const BatchSelector: React.FC<BatchSelectorProps> = ({
  maxBatchSize,
  onSelectSize,
  disabled
}) => {
  return (
    <div id="batch-selector-container" className="flex flex-col gap-2">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batch Size Limit</span>
      <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1 border border-slate-200/40 w-fit">
        {BATCH_SIZES.map((size) => {
          const isActive = maxBatchSize === size;
          return (
            <button
              key={size}
              onClick={() => !disabled && onSelectSize(size)}
              disabled={disabled}
              className={`rounded-lg px-4 py-1.5 text-[11px] font-extrabold transition-all ${
                disabled
                  ? 'opacity-40 cursor-not-allowed text-slate-400'
                  : isActive
                  ? 'bg-white text-violet-600 shadow-sm border border-slate-200/10 scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-700 cursor-pointer'
              }`}
            >
              {size} {size === 1 ? 'Image' : 'Images'}
            </button>
          );
        })}
      </div>
    </div>
  );
};
