import React, { useRef, useEffect, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { useComparison } from '../hooks/useComparison';
import { X } from 'lucide-react';

interface BeforeAfterSliderProps {
  originalUrl: string;
  cleanedUrl: string;
  filename: string;
  onClose: () => void;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  originalUrl,
  cleanedUrl,
  filename,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    sliderPosition,
    isDragging,
    startDrag,
    stopDrag,
    onDrag,
    handleKeyDown,
  } = useComparison(50);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    onDrag(clientX, rect.width, rect.left);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    if (e.touches && e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  useEffect(() => {
    const handleMouseUp = () => stopDrag();
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  const onMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    startDrag();
    handleMove(e.clientX);
  };

  const onTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    startDrag();
    if (e.touches && e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  return (
    <div
      id="before-after-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="relative flex w-full max-w-4xl flex-col rounded-[24px] border border-slate-100 bg-white shadow-2xl overflow-hidden focus:outline-none">
        
        <div className="flex items-center justify-between border-b border-slate-100 p-5 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-black text-violet-700 tracking-wider uppercase">
              See the difference
            </h3>
            <p className="text-xs text-slate-500 font-bold truncate max-w-xs sm:max-w-md mt-0.5">
              {filename}
            </p>
          </div>
          <button
            id="close-compare-modal"
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white border border-slate-200 hover:border-violet-300 hover:bg-slate-50 p-2 text-slate-400 transition-colors cursor-pointer hover:text-slate-900"
            aria-label="Close Comparison"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative p-5 md:p-8 flex flex-col items-center justify-center bg-white">
          <div
            id="slider-container"
            ref={containerRef}
            className="relative aspect-video w-full max-w-3xl select-none overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-inner"
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
          >
            <img
              src={originalUrl}
              alt="Before"
              className="absolute inset-0 h-full w-full object-contain pointer-events-none mx-auto bg-slate-100"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-4 left-4 z-10 rounded-lg bg-slate-950/80 px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-100 uppercase pointer-events-none">
              BEFORE
            </div>

            <div
              className="absolute inset-0 h-full pointer-events-none"
              style={{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }}
            >
              <img
                src={cleanedUrl}
                alt="After"
                className="absolute inset-0 h-full w-full object-contain pointer-events-none mx-auto bg-slate-100"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-4 left-4 z-10 rounded-lg bg-violet-600 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white uppercase pointer-events-none">
                AFTER
              </div>
            </div>

            <div
              className="absolute bottom-0 top-0 w-0.5 bg-violet-500/80 cursor-ew-resize z-20"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-violet-600 text-white shadow-xl pointer-events-none border-2 border-white scale-110 animate-bounce-subtle">
                <span className="text-xs font-black tracking-tighter">←→</span>
              </div>
            </div>
          </div>

          <div className="mt-5 text-center flex flex-wrap gap-2 justify-center items-center">
            <span className="text-xs text-slate-500 font-bold bg-slate-100/80 px-3 py-1 rounded-full">Drag slider to compare</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline text-xs text-slate-500 font-bold bg-slate-100/80 px-3 py-1 rounded-full">Use Keyboard Arrow Keys ← / →</span>
          </div>
        </div>
      </div>
    </div>
  );
};
