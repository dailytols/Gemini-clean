import React from 'react';
import { Lock, Sparkles } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div id="app-hero" className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100/50 py-12 md:py-16 border-b border-slate-100">
      
      {/* Soft floating sparkle particles (sparse & decorative) */}
      <div className="absolute top-12 left-[12%] text-violet-400 opacity-40 animate-[bounce_5s_infinite_alternate] pointer-events-none">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="absolute bottom-16 right-[15%] text-pink-400 opacity-40 animate-[bounce_7s_infinite_alternate] pointer-events-none">
        <Sparkles className="h-4.5 w-4.5" />
      </div>
      <div className="absolute top-24 right-[10%] text-blue-400 opacity-30 animate-[pulse_4s_infinite_alternate] pointer-events-none">
        <Sparkles className="h-3.5 w-3.5" />
      </div>

      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8 relative z-10">
        
        {/* Subtle pulsing/floating mini header badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-100/70 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-700 shadow-sm shadow-violet-50">
          <Sparkles className="h-3 w-3 text-violet-500 animate-[spin_6s_linear_infinite]" />
          <span>Next-Gen Image Reconstruction Sandbox</span>
        </div>

        {/* Headline with vibrant gradient-text */}
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl leading-tight">
          Clean visible <span className="gradient-text font-black">Gemini logos.</span><br />
          <span className="text-slate-800 font-bold block mt-1">Keep the image.</span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-sm md:text-base text-slate-500 leading-relaxed font-medium">
          Fast browser-side image cleaning with automatic detection, visual comparison, and bulk export. 
          <span className="text-violet-600 font-semibold block mt-1.5">No files are uploaded to remote servers or cloud storage.</span>
        </p>

        {/* Dynamic visual roadmap indicators */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 text-[10px] font-bold tracking-wider uppercase text-slate-400">
          <span className="px-2.5 py-1 rounded bg-slate-100/80 text-violet-600">Upload</span>
          <span className="text-slate-300 font-normal">→</span>
          <span className="px-2.5 py-1 rounded bg-slate-100/80 text-blue-600">Detect</span>
          <span className="text-slate-300 font-normal">→</span>
          <span className="px-2.5 py-1 rounded bg-slate-100/80 text-emerald-600">Clean</span>
          <span className="text-slate-300 font-normal">→</span>
          <span className="px-2.5 py-1 rounded bg-slate-100/80 text-pink-600">Compare</span>
          <span className="text-slate-300 font-normal">→</span>
          <span className="px-2.5 py-1 rounded bg-slate-100/80 text-orange-600">Download</span>
        </div>
      </div>
    </div>
  );
};
