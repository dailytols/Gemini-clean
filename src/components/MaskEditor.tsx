import React, { useRef, useEffect, useState, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { Brush, Eraser, Undo, Redo, RotateCcw, Check, X, Sliders } from 'lucide-react';
import { QueueImage } from '../types/image';

interface MaskEditorProps {
  imageItem: QueueImage;
  onApply: (id: string, customMaskData: Uint8ClampedArray) => void;
  onClose: () => void;
}

export const MaskEditor: React.FC<MaskEditorProps> = ({ imageItem, onApply, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [brushSize, setBrushSize] = useState<number>(30);
  const [isPainting, setIsPainting] = useState<boolean>(false);

  // Undo / Redo history stacks containing Uint8ClampedArray data
  const [undoStack, setUndoStack] = useState<Uint8ClampedArray[]>([]);
  const [redoStack, setRedoStack] = useState<Uint8ClampedArray[]>([]);

  const [naturalWidth, setNaturalWidth] = useState<number>(0);
  const [naturalHeight, setNaturalHeight] = useState<number>(0);

  // Load and draw image & mask on mount
  useEffect(() => {
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageItem.originalUrl;
    img.onload = () => {
      if (!active) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setNaturalWidth(w);
      setNaturalHeight(h);

      const imgCanvas = imageCanvasRef.current;
      const mCanvas = maskCanvasRef.current;
      if (!imgCanvas || !mCanvas) return;

      imgCanvas.width = w;
      imgCanvas.height = h;
      mCanvas.width = w;
      mCanvas.height = h;

      const iCtx = imgCanvas.getContext('2d');
      const mCtx = mCanvas.getContext('2d');
      if (!iCtx || !mCtx) return;

      // Draw original image
      iCtx.drawImage(img, 0, 0);

      // Draw initial mask
      mCtx.fillStyle = 'rgba(0,0,0,0)';
      mCtx.fillRect(0, 0, w, h);

      if (imageItem.customMaskData) {
        const maskImgData = mCtx.createImageData(w, h);
        maskImgData.data.set(imageItem.customMaskData);
        mCtx.putImageData(maskImgData, 0, 0);
      } else if (imageItem.detection?.maskData) {
        const maskImgData = mCtx.createImageData(w, h);
        maskImgData.data.set(imageItem.detection.maskData);
        mCtx.putImageData(maskImgData, 0, 0);
      } else if (imageItem.detection?.bbox) {
        // Draw bounding box mask if no segmentation exists
        mCtx.fillStyle = 'rgba(255, 0, 0, 0.45)';
        const { x, y, width, height } = imageItem.detection.bbox;
        mCtx.fillRect(x, y, width, height);
      }

      // Capture initial state to undo stack
      const initialBytes = mCtx.getImageData(0, 0, w, h).data;
      setUndoStack([new Uint8ClampedArray(initialBytes)]);
    };

    return () => {
      active = false;
    };
  }, [imageItem]);

  // Save current mask state to undo stack
  const saveState = () => {
    const mCanvas = maskCanvasRef.current;
    if (!mCanvas) return;
    const mCtx = mCanvas.getContext('2d');
    if (!mCtx) return;

    const data = mCtx.getImageData(0, 0, mCanvas.width, mCanvas.height).data;
    setUndoStack((prev) => [...prev, new Uint8ClampedArray(data)]);
    setRedoStack([]); // Clear redo on action
  };

  const handleUndo = () => {
    if (undoStack.length <= 1) return; // Need at least the original state

    const mCanvas = maskCanvasRef.current;
    if (!mCanvas) return;
    const mCtx = mCanvas.getContext('2d');
    if (!mCtx) return;

    const current = undoStack[undoStack.length - 1];
    const prev = undoStack[undoStack.length - 2];

    setUndoStack((p) => p.slice(0, -1));
    setRedoStack((r) => [...r, current]);

    const imgData = mCtx.createImageData(mCanvas.width, mCanvas.height);
    imgData.data.set(prev);
    mCtx.putImageData(imgData, 0, 0);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const mCanvas = maskCanvasRef.current;
    if (!mCanvas) return;
    const mCtx = mCanvas.getContext('2d');
    if (!mCtx) return;

    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((p) => [...p, next]);

    const imgData = mCtx.createImageData(mCanvas.width, mCanvas.height);
    imgData.data.set(next);
    mCtx.putImageData(imgData, 0, 0);
  };

  const handleReset = () => {
    const mCanvas = maskCanvasRef.current;
    if (!mCanvas) return;
    const mCtx = mCanvas.getContext('2d');
    if (!mCtx) return;

    mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);
    
    // Draw initial detected mask or bounding box
    if (imageItem.detection?.maskData) {
      const maskImgData = mCtx.createImageData(mCanvas.width, mCanvas.height);
      maskImgData.data.set(imageItem.detection.maskData);
      mCtx.putImageData(maskImgData, 0, 0);
    } else if (imageItem.detection?.bbox) {
      mCtx.fillStyle = 'rgba(255, 0, 0, 1)';
      const { x, y, width, height } = imageItem.detection.bbox;
      mCtx.fillRect(x, y, width, height);
    }

    saveState();
  };

  // Canvas drawing coordinate calculations
  const getCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const mCanvas = maskCanvasRef.current;
    if (!mCanvas) return null;
    const rect = mCanvas.getBoundingClientRect();

    // Scale coordinates according to difference between CSS rendering size and natural size
    const x = ((clientX - rect.left) / rect.width) * mCanvas.width;
    const y = ((clientY - rect.top) / rect.height) * mCanvas.height;

    return { x, y };
  };

  const handleStartDraw = (clientX: number, clientY: number) => {
    const coords = getCanvasCoords(clientX, clientY);
    if (!coords) return;

    setIsPainting(true);
    draw(coords.x, coords.y, true);
  };

  const handleMoveDraw = (clientX: number, clientY: number) => {
    if (!isPainting) return;
    const coords = getCanvasCoords(clientX, clientY);
    if (!coords) return;

    draw(coords.x, coords.y, false);
  };

  const handleStopDraw = () => {
    if (!isPainting) return;
    setIsPainting(false);
    saveState();
  };

  const draw = (x: number, y: number, isStarting: boolean) => {
    const mCanvas = maskCanvasRef.current;
    if (!mCanvas) return;
    const mCtx = mCanvas.getContext('2d');
    if (!mCtx) return;

    mCtx.lineWidth = brushSize;
    mCtx.lineCap = 'round';
    mCtx.lineJoin = 'round';

    if (tool === 'brush') {
      mCtx.globalCompositeOperation = 'source-over';
      mCtx.strokeStyle = 'rgba(255, 0, 0, 1)'; // Solid red for raw mask
    } else {
      mCtx.globalCompositeOperation = 'destination-out';
    }

    if (isStarting) {
      mCtx.beginPath();
      mCtx.moveTo(x, y);
      mCtx.lineTo(x, y);
      mCtx.stroke();
    } else {
      mCtx.lineTo(x, y);
      mCtx.stroke();
    }
  };

  // Mouse events
  const onMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleStartDraw(e.clientX, e.clientY);
  };

  const onMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    handleMoveDraw(e.clientX, e.clientY);
  };

  // Touch events for mobile/tablet inpainting
  const onTouchStart = (e: ReactTouchEvent<HTMLCanvasElement>) => {
    if (e.touches && e.touches[0]) {
      handleStartDraw(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const onTouchMove = (e: ReactTouchEvent<HTMLCanvasElement>) => {
    if (e.touches && e.touches[0]) {
      handleMoveDraw(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleApply = () => {
    const mCanvas = maskCanvasRef.current;
    if (!mCanvas) return;
    const mCtx = mCanvas.getContext('2d');
    if (!mCtx) return;

    const data = mCtx.getImageData(0, 0, mCanvas.width, mCanvas.height).data;
    onApply(imageItem.id, new Uint8ClampedArray(data));
  };

  return (
    <div
      id="mask-editor-modal"
      className="fixed inset-0 z-50 flex flex-col bg-slate-50 p-4 sm:p-6"
    >
      {/* Editor Header Bar */}
      <div className="flex flex-col gap-3 border-b border-slate-200/60 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-violet-700">
            Manual Fine-Tune Editor
          </h3>
          <p className="text-xs text-slate-500 font-bold truncate max-w-xs sm:max-w-md mt-1">
            {imageItem.name} <span className="text-slate-300 mx-1">•</span> {naturalWidth} × {naturalHeight} px
          </p>
        </div>

        {/* Header Exit Actions */}
        <div className="flex items-center gap-2">
          <button
            id="close-editor-btn"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 hover:border-violet-350 hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-500 transition-colors cursor-pointer hover:text-slate-900"
          >
            <X className="h-4 w-4" />
            <span>Cancel</span>
          </button>

          <button
            id="apply-mask-btn"
            onClick={handleApply}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-violet-700 cursor-pointer shadow-md shadow-violet-200"
          >
            <Check className="h-4 w-4" />
            <span>Apply Mask</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row gap-6 mt-6">
        {/* Left Side: Toolbar Controls */}
        <div className="flex flex-col gap-5 lg:w-60 lg:border-r lg:border-slate-200/60 lg:pr-6 shrink-0">
          
          {/* Tool selectors */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Draw Tools</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="brush-tool-btn"
                onClick={() => setTool('brush')}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer ${
                  tool === 'brush'
                    ? 'bg-violet-50 border border-violet-200 text-violet-600 shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Brush className="h-4 w-4" />
                <span>Brush</span>
              </button>

              <button
                id="eraser-tool-btn"
                onClick={() => setTool('eraser')}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer ${
                  tool === 'eraser'
                    ? 'bg-violet-50 border border-violet-200 text-violet-600 shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Eraser className="h-4 w-4" />
                <span>Eraser</span>
              </button>
            </div>
          </div>

          {/* Size slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1">
                <Sliders className="h-3.5 w-3.5 text-violet-600" />
                <span>Brush Size</span>
              </span>
              <span className="font-extrabold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded text-[10px]">{brushSize}px</span>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full accent-violet-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
            />
          </div>

          {/* History control items */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">History</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                id="undo-btn"
                disabled={undoStack.length <= 1}
                onClick={handleUndo}
                className="flex flex-col items-center justify-center rounded-xl bg-white border border-slate-200 py-2.5 text-[10px] font-bold text-slate-500 transition-colors hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                title="Undo last stroke"
              >
                <Undo className="h-4 w-4 text-slate-400" />
                <span className="mt-1">Undo</span>
              </button>

              <button
                id="redo-btn"
                disabled={redoStack.length === 0}
                onClick={handleRedo}
                className="flex flex-col items-center justify-center rounded-xl bg-white border border-slate-200 py-2.5 text-[10px] font-bold text-slate-500 transition-colors hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                title="Redo stroke"
              >
                <Redo className="h-4 w-4 text-slate-400" />
                <span className="mt-1">Redo</span>
              </button>

              <button
                id="reset-detection-btn"
                onClick={handleReset}
                className="flex flex-col items-center justify-center rounded-xl bg-white border border-slate-200 py-2.5 text-[10px] font-bold text-slate-500 transition-colors hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 cursor-pointer"
                title="Reset to automatic detection state"
              >
                <RotateCcw className="h-4 w-4 text-slate-400 hover:text-rose-500" />
                <span className="mt-1">Reset</span>
              </button>
            </div>
          </div>

          {/* Color key explanation */}
          <div className="mt-auto hidden rounded-2xl bg-white border border-slate-100 p-4 lg:block shadow-sm">
            <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Editor Tip</h5>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400 font-semibold">
              Paint over the logos. The red overlay shows exactly where inpainting reconstruction will take place. Keep the mask as tight as possible for pristine results.
            </p>
          </div>
        </div>

        {/* Right Side: Interactive Paint Sandbox */}
        <div
          ref={containerRef}
          className="relative flex-1 rounded-[24px] bg-white border border-slate-150 shadow-md overflow-hidden flex items-center justify-center p-4 min-h-[350px] lg:min-h-0"
        >
          <div className="relative max-h-full max-w-full select-none" style={{ aspectRatio: `${naturalWidth}/${naturalHeight}` }}>
            {/* Background Canvas: Original Image */}
            <canvas
              ref={imageCanvasRef}
              className="max-h-[70vh] max-w-full object-contain pointer-events-none rounded-xl"
            />

            {/* Foreground Canvas: Semi-transparent Interactive Mask */}
            <canvas
              ref={maskCanvasRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={handleStopDraw}
              onMouseLeave={handleStopDraw}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={handleStopDraw}
              className="absolute inset-0 max-h-[70vh] max-w-full cursor-crosshair object-contain opacity-45 rounded-xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
