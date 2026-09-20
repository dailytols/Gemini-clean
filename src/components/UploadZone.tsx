import React, { useRef, useState, DragEvent } from 'react';
import { UploadCloud, FolderOpen } from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFilesSelected, disabled }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      onFilesSelected(filesArray);
    }
  };

  const handleFileChange = () => {
    if (fileInputRef.current && fileInputRef.current.files) {
      const filesArray = Array.from(fileInputRef.current.files);
      onFilesSelected(filesArray);
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = (e: React.MouseEvent) => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div
      id="upload-zone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerFileInput}
      className={`group relative flex flex-col items-center justify-center rounded-[24px] border-2 border-dashed p-8 md:p-12 text-center transition-all duration-300 shadow-xl ${
        disabled
          ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 shadow-none'
          : isDragOver
          ? 'border-violet-500 bg-violet-50/50 cursor-copy scale-[1.01] shadow-violet-100/80'
          : 'border-slate-200 bg-white hover:bg-slate-50/40 hover:border-violet-300 hover:shadow-violet-100/40 cursor-pointer'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
        accept="image/png, image/jpeg, image/jpg, image/webp"
        disabled={disabled}
      />

      <div className="absolute inset-2 rounded-[20px] border border-slate-100/50 pointer-events-none group-hover:border-violet-100/50 transition-colors" />

      <div className={`flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 ${
        isDragOver 
          ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 scale-110' 
          : 'bg-violet-50 border border-violet-100 text-violet-600 group-hover:bg-violet-100 group-hover:scale-105 group-hover:shadow-md'
      }`}>
        <UploadCloud className="h-8 w-8 animate-[pulse_2s_infinite]" />
      </div>

      <h3 className="mt-5 text-base md:text-lg font-bold tracking-tight text-slate-950">
        Drop your images here
      </h3>
      
      <p className="mt-1 text-xs text-slate-400 font-medium uppercase tracking-wide">
        or browse files
      </p>

      <div className="mt-4">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerFileInput(e);
          }}
          disabled={disabled}
          className={`flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-md ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] shadow-violet-200'
          }`}
        >
          <FolderOpen className="h-4 w-4" />
          <span>Choose from Gallery</span>
        </button>
      </div>
      
      <p className="mt-4 text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100 px-3 py-1 rounded-full">
        PNG · JPG · WEBP · Up to 20 images
      </p>
    </div>
  );
};
