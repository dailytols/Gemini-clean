import React from 'react';
import { QueueImage } from '../types/image';
import { QueueItem } from './QueueItem';
import { Image as ImageIcon } from 'lucide-react';

interface QueueProps {
  images: QueueImage[];
  onRemove: (id: string) => void;
  onFineTune?: (image: QueueImage) => void;
  disabled?: boolean;
}

export const Queue: React.FC<QueueProps> = ({ images, onRemove, onFineTune, disabled }) => {
  if (images.length === 0) {
    return (
      <div id="empty-queue" className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center text-slate-400">
        <ImageIcon className="h-8 w-8 stroke-1.5 mb-2.5" />
        <span className="text-xs font-bold uppercase tracking-wider">No images uploaded yet</span>
        <p className="text-[10px] mt-1 font-semibold max-w-xs leading-relaxed">
          Your image queue is empty. Drag and drop pictures or select them from your gallery.
        </p>
      </div>
    );
  }

  return (
    <div id="queue-list" className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
      <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
        <span>Image queue list</span>
        <span>{images.length} item{images.length === 1 ? '' : 's'}</span>
      </div>
      <div className="space-y-2">
        {images.map((item) => (
          <QueueItem
            key={item.id}
            item={item}
            onRemove={onRemove}
            onFineTune={onFineTune}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
};
