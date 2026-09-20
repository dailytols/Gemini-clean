import React from 'react';
import { ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer id="app-footer" className="mt-16 border-t border-slate-100 bg-slate-50/50 py-12">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        
        {/* Compliance & Privacy statement */}
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-100 bg-white p-5 shadow-sm text-left mb-8">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0 mt-0.5">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Privacy Protection Assurance & Scope Notice
              </h4>
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400 font-bold uppercase tracking-wider">
                No invisible watermarks (e.g. SynthID) or provenance layers are altered or touched.
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 font-medium">
                This utility operates entirely within your local browser sandbox to remove visible overlays. No image, raw asset, or data package is sent, uploaded, or cached on remote servers or cloud databases, unless you explicitly choose to authorize the optional remote model backup.
              </p>
            </div>
          </div>
        </div>

        {/* Branding copyright */}
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
          <span>Gemini Clean v2.0</span>
          <span>•</span>
          <span>Local Image Reconstruction Engine</span>
        </p>

        <p className="mt-2.5 text-[10px] font-semibold text-slate-400 flex items-center justify-center gap-1.5">
          <span>Made with</span>
          <Heart className="h-3.5 w-3.5 fill-pink-400 text-pink-400 animate-pulse" />
          <span>locally in your browser</span>
        </p>
      </div>
    </footer>
  );
};
