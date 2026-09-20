import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { BatchSelector } from './components/BatchSelector';
import { UploadZone } from './components/UploadZone';
import { Queue } from './components/Queue';
import { ProcessingProgress } from './components/ProcessingProgress';
import { ResultsGrid } from './components/ResultsGrid';
import { BeforeAfterSlider } from './components/BeforeAfterSlider';
import { MaskEditor } from './components/MaskEditor';
import { Settings } from './components/Settings';
import { DownloadSection } from './components/DownloadSection';
import { Footer } from './components/Footer';

import { useSettings } from './hooks/useSettings';
import { useImageQueue } from './hooks/useImageQueue';
import { useImageProcessor } from './hooks/useImageProcessor';

import { QueueImage } from './types/image';
import { loadOpenCV } from './services/inpainting';
import { safeRevokeUrl } from './utils/memory';

import { Terminal, RefreshCw, Sparkles } from 'lucide-react';

export default function App() {
  const { settings, setSettings } = useSettings();

  const {
    images,
    maxBatchSize,
    setMaxBatchSize,
    errorMsg,
    setErrorMsg,
    addFiles,
    removeImage,
    clearQueue,
    updateImage,
    overallProgress,
  } = useImageQueue();

  // Sync max batch size based on selected settings profile
  useEffect(() => {
    setMaxBatchSize(settings.processingMode === 'low-memory' ? 1 : 20);
  }, [settings.processingMode, setMaxBatchSize]);

  const {
    isProcessing,
    currentIndex,
    logs,
    startProcessing,
    cancelProcessing,
    clearLogs,
  } = useImageProcessor(images, updateImage, settings);

  // Modal active states
  const [showSettings, setShowSettings] = useState<boolean>(true);
  const [activeCompareImage, setActiveCompareImage] = useState<QueueImage | null>(null);
  const [activeFineTuneImage, setActiveFineTuneImage] = useState<QueueImage | null>(null);

  // Preload OpenCV.js in background on mount
  const [isOpenCvLoading, setIsOpenCvLoading] = useState<boolean>(false);
  const [isOpenCvLoaded, setIsOpenCvLoaded] = useState<boolean>(false);

  useEffect(() => {
    setIsOpenCvLoading(true);
    loadOpenCV()
      .then(() => {
        setIsOpenCvLoaded(true);
        setIsOpenCvLoading(false);
        console.log('OpenCV.js successfully preloaded in background.');
      })
      .catch((err) => {
        setIsOpenCvLoading(false);
        console.warn('OpenCV.js failed to load in background:', err);
      });
  }, []);

  // Handle custom manual mask fine-tuning
  const handleApplyCustomMask = (id: string, customMaskData: Uint8ClampedArray) => {
    const target = images.find((img) => img.id === id);
    if (!target) return;

    const updated: QueueImage = {
      ...target,
      customMaskData,
      status: 'QUEUED',
      progress: 0,
      cleanedUrl: undefined,
    };

    if (target.cleanedUrl) {
      safeRevokeUrl(target.cleanedUrl);
    }

    updateImage(updated);
    setActiveFineTuneImage(null);
    setErrorMsg(null);
  };

  const hasQueuedOrError = useMemo(() => {
    return images.some((img) => img.status === 'QUEUED' || img.status === 'ERROR');
  }, [images]);

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col font-sans selection:bg-violet-500/20 selection:text-violet-900 relative overflow-x-hidden">
      {/* Decorative gradient background animations */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-400/10 blur-[120px] pointer-events-none animate-pulse-slow z-0" />
      <div className="absolute top-[20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-indigo-300/15 blur-[120px] pointer-events-none animate-pulse-slow z-0" />
      <div className="absolute bottom-[10%] left-[5%] w-[40%] h-[40%] rounded-full bg-pink-300/10 blur-[120px] pointer-events-none animate-pulse-slow z-0" />

      {/* Navigation Header */}
      <Header
        onOpenSettings={() => setShowSettings((p) => !p)}
        openSettingsActive={showSettings}
      />

      {/* Hero Header Area */}
      <Hero />

      {/* Main Sandbox Dashboard */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        <div className="workspace rounded-[32px] p-px shadow-xl shadow-indigo-100/40 relative overflow-hidden bg-slate-100 border border-slate-200/50">
          <div className="bg-white/90 backdrop-blur-xl rounded-[31px] p-5 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Sandbox Column: upload parameters, settings configuration */}
              <section className="lg:col-span-5 space-y-6">
                <div className="rounded-[24px] border border-slate-100 bg-slate-50/40 p-5 space-y-5 shadow-sm">
                  <BatchSelector
                    maxBatchSize={maxBatchSize}
                    onSelectSize={(size) => {
                      setMaxBatchSize(size);
                      if (size === 1) {
                        setSettings((p) => ({ ...p, processingMode: 'low-memory' }));
                      } else {
                        setSettings((p) => ({ ...p, processingMode: 'balanced' }));
                      }
                    }}
                    disabled={isProcessing || images.length > 0}
                  />

                  <UploadZone
                    onFilesSelected={addFiles}
                    disabled={isProcessing || images.length >= maxBatchSize}
                  />

                  {errorMsg && (
                    <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-xs text-rose-600 font-bold leading-relaxed shadow-sm">
                      {errorMsg}
                    </div>
                  )}
                </div>

                {/* Processing controls */}
                {images.length > 0 && !isProcessing && hasQueuedOrError && (
                  <button
                    onClick={startProcessing}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white py-3 px-4 text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-violet-200 hover:scale-[1.01] cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Start Cleaning Batch</span>
                  </button>
                )}

                {isProcessing && (
                  <button
                    onClick={cancelProcessing}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 py-3 px-4 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Stop Queue Processing</span>
                  </button>
                )}

                {/* Queue Display */}
                <Queue
                  images={images}
                  onRemove={removeImage}
                  onFineTune={setActiveFineTuneImage}
                  disabled={isProcessing}
                />

                {/* Console Log Terminal */}
                {logs.length > 0 && (
                  <div className="rounded-[24px] border border-slate-100 bg-white p-5 space-y-3 shadow-md shadow-violet-100/10">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Terminal className="h-3.5 w-3.5 text-violet-500" />
                        <span>Console Output Terminal</span>
                      </span>
                      <button onClick={clearLogs} className="hover:text-slate-800 transition-colors cursor-pointer font-bold">
                        Clear
                      </button>
                    </div>
                    
                    <div className="h-32 overflow-y-auto font-mono text-[10px] leading-relaxed text-slate-500 space-y-1.5 scrollbar-thin bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {logs.map((log, idx) => (
                        <div key={idx} className="whitespace-pre-wrap break-all border-l-2 border-slate-200 pl-2 py-0.5 font-medium">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showSettings && (
                  <Settings
                    settings={settings}
                    onUpdateSettings={setSettings}
                    onClose={() => setShowSettings(false)}
                  />
                )}
              </section>

              {/* Right Output Column: processing status meters, cleaned visual output grid */}
              <section className="lg:col-span-7 space-y-6">
                {isProcessing && (
                  <ProcessingProgress
                    progress={overallProgress}
                    label={`Cleaning Images (${currentIndex}/${images.length})`}
                  />
                )}

                {/* Results Workspace Grid */}
                <ResultsGrid
                  images={images}
                  onCompare={setActiveCompareImage}
                />

                {/* Bulk zip actions */}
                <DownloadSection
                  images={images}
                  onClear={clearQueue}
                  disabled={isProcessing}
                />

                {/* Fallback onboarding view */}
                {images.length === 0 && (
                  <div className="rounded-[24px] border-2 border-dashed border-slate-200 bg-white p-12 text-center space-y-4 shadow-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 border border-violet-100 text-violet-600">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-extrabold text-slate-700">Sandbox Awaiting Images</p>
                      <p className="text-xs text-slate-400 font-semibold max-w-sm mx-auto leading-relaxed">
                        Specify batch constraints, drop your watermarked graphics into the dropzone, and start lossless client-side reconstruction instantly.
                      </p>
                    </div>
                  </div>
                )}
              </section>

            </div>
          </div>
        </div>
      </main>

      {/* Brand Compliance Footer */}
      <Footer />

      {/* Split visual comparisons */}
      {activeCompareImage && activeCompareImage.cleanedUrl && (
        <BeforeAfterSlider
          originalUrl={activeCompareImage.originalUrl}
          cleanedUrl={activeCompareImage.cleanedUrl}
          filename={activeCompareImage.name}
          onClose={() => setActiveCompareImage(null)}
        />
      )}

      {/* Interactive visual mask canvas painting */}
      {activeFineTuneImage && (
        <MaskEditor
          imageItem={activeFineTuneImage}
          onApply={handleApplyCustomMask}
          onClose={() => setActiveFineTuneImage(null)}
        />
      )}
    </div>
  );
}
