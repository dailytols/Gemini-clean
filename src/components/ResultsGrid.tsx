import React from 'react';
import { QueueImage } from '../types/image';
import { ResultCard } from './ResultCard';

interface ResultsGridProps {
  images: QueueImage[];
  onCompare: (image: QueueImage) => void;
}

export const ResultsGrid: React.FC<ResultsGridProps> = ({ images, onCompare }) => {
  const cleanedImages = images.filter((img) => img.status === 'DONE');

  if (cleanedImages.length === 0) {
    return null;
  }

  return (
    <div id="results-workspace" className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
          Cleaned images output ({cleanedImages.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
        {cleanedImages.map((img) => (
          <ResultCard
            key={img.id}
            image={img}
            onCompare={onCompare}
          />
        ))}
      </div>
    </div>
  );
};
