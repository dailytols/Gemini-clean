import React from 'react';

interface ProcessingProgressProps {
  progress: number;
  label?: string;
}

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({ progress, label = 'Overall progress' }) => {
  return (
    <div id="processing-progress-bar" className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-violet-100/30">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
        <span className="text-slate-600">{label}</span>
        <span className="text-violet-600 font-extrabold">{progress}% Complete</span>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="absolute inset-y-0 left-0 h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-blue-500 transition-all duration-400 ease-out"
          style={{ width: `${progress}%` }}
        />
        {progress > 0 && progress < 100 && (
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.25)_50%,rgba(255,255,255,0)_100%)] w-2/3 h-full animate-[shimmer_1.5s_infinite]" />
        )}
      </div>
    </div>
  );
};
