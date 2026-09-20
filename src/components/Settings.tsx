import React from 'react';
import { AppSettings, InpaintingMethod, OutputFormat, ProcessingMode } from '../types/settings';
import { Sliders, Lock } from 'lucide-react';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  return (
    <div id="settings-panel" className="w-full rounded-[24px] border border-slate-100 bg-slate-50/60 p-5 space-y-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-800">
          <Sliders className="h-4 w-4 text-violet-600" />
          <span>Image Core Settings</span>
        </span>
        <button
          onClick={onClose}
          className="text-[10px] font-bold text-slate-400 uppercase tracking-wide hover:text-slate-950 cursor-pointer"
        >
          Hide Settings
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700">Confidence Threshold</label>
          <span className="text-xs font-black text-violet-600">{(settings.detectionConfidence * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="50"
          max="95"
          step="5"
          value={settings.detectionConfidence * 100}
          onChange={(e) => updateField('detectionConfidence', parseInt(e.target.value) / 100)}
          className="w-full accent-violet-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
        />
        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
          Low limits detect softer logos, high limits prevent false positives. Default is 70%.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 block">Inpainting Algorithm</label>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/40">
          {(['auto', 'telea', 'navier-stokes'] as InpaintingMethod[]).map((m) => {
            const isActive = settings.inpaintingMethod === m;
            return (
              <button
                key={m}
                onClick={() => updateField('inpaintingMethod', m)}
                className={`rounded-lg py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-violet-600 shadow-sm border border-slate-200/20'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
          Auto uses fast-diffusion. Telea & Navier-Stokes require OpenCV.js to load.
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-700 block">Output Format</label>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/40">
          {(['png', 'jpg'] as OutputFormat[]).map((f) => {
            const isActive = settings.outputFormat === f;
            return (
              <button
                key={f}
                onClick={() => updateField('outputFormat', f)}
                className={`rounded-lg py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-violet-600 shadow-sm border border-slate-200/20'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {f.toUpperCase()}
              </button>
            );
          })}
        </div>

        {settings.outputFormat === 'jpg' && (
          <div className="space-y-2 pl-3 border-l-2 border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">JPEG Quality</span>
              <span className="text-[10px] font-black text-violet-600">{settings.jpgQuality}%</span>
            </div>
            <input
              type="range"
              min="70"
              max="100"
              step="5"
              value={settings.jpgQuality}
              onChange={(e) => updateField('jpgQuality', parseInt(e.target.value))}
              className="w-full accent-violet-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 block">Processing Profile</label>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200/40">
          {(['balanced', 'quality', 'low-memory'] as ProcessingMode[]).map((mode) => {
            const isActive = settings.processingMode === mode;
            return (
              <button
                key={mode}
                onClick={() => updateField('processingMode', mode)}
                className={`rounded-lg py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-violet-600 shadow-sm border border-slate-200/20'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {mode === 'low-memory' ? 'Low RAM' : mode}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
          Low RAM processes strictly 1 image at a time, protecting low-memory mobile browsers from crashes.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-3.5 space-y-2 shadow-sm">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-violet-500" />
            <span>Server Processing Backup</span>
          </label>
          <input
            type="checkbox"
            checked={settings.useServerProcessing}
            onChange={(e) => updateField('useServerProcessing', e.target.checked)}
            className="rounded border-slate-200 bg-white text-violet-600 focus:ring-0 focus:ring-offset-0 h-4.5 w-4.5 accent-violet-600 cursor-pointer"
          />
        </div>
        <p className="text-[10px] leading-relaxed text-slate-400 font-semibold">
          Off by default. Enabling upload allows backup remote model processing.
        </p>
      </div>
    </div>
  );
};
