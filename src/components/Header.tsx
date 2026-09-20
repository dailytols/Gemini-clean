import React from 'react';
import { Sparkles, Settings, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  openSettingsActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, openSettingsActive }) => {
  return (
    <header id="app-header" className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 border border-violet-100 text-violet-600 animate-[pulse_3s_infinite_alternate]">
            <Sparkles className="h-5 w-5 animate-[spin_12s_linear_infinite]" />
          </div>
          <div>
            <span className="text-md font-bold tracking-tight text-slate-900">
              Gemini <span className="text-violet-600">Clean</span>
            </span>
            <span className="ml-2 hidden rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-500 sm:inline">
              V2.0
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Pulsing Badge: PRIVATE • LOCAL PROCESSING */}
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100/60 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] tracking-wider uppercase font-bold">Private • Local Processing</span>
          </div>

          <button
            id="settings-toggle-btn"
            onClick={onOpenSettings}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 ${
              openSettingsActive
                ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-100'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-950 hover:bg-slate-50'
            }`}
            aria-label="Toggle Settings Panel"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
