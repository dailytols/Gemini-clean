import { useState, useCallback, KeyboardEvent } from 'react';

export function useComparison(initialSliderPosition = 50) {
  const [sliderPosition, setSliderPosition] = useState<number>(initialSliderPosition);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const startDrag = useCallback(() => {
    setIsDragging(true);
  }, []);

  const stopDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onDrag = useCallback(
    (clientX: number, containerWidth: number, containerLeft: number) => {
      if (containerWidth === 0) return;
      const x = clientX - containerLeft;
      const percentage = Math.max(0, Math.min(100, (x / containerWidth) * 100));
      setSliderPosition(percentage);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSliderPosition((prev) => Math.max(0, prev - 2));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSliderPosition((prev) => Math.min(100, prev + 2));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setSliderPosition(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setSliderPosition(100);
      }
    },
    []
  );

  return {
    sliderPosition,
    setSliderPosition,
    isDragging,
    startDrag,
    stopDrag,
    onDrag,
    handleKeyDown,
  };
}
