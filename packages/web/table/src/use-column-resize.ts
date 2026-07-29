import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export interface UseColumnResizeOptions {
  startWidth: number;
  minWidth?: number;
  onChange: (px: number) => void;
}

export interface UseColumnResizeHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
}

export function useColumnResize(opts: UseColumnResizeOptions): UseColumnResizeHandlers {
  const { startWidth, minWidth = 64, onChange } = opts;
  const startX = useRef<number | null>(null);
  const startWidthRef = useRef(startWidth);

  return {
    onPointerDown(e) {
      e.preventDefault();
      startX.current = e.clientX;
      startWidthRef.current = startWidth;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove(e) {
      if (startX.current === null) {
        return;
      }
      const delta = e.clientX - startX.current;
      const next = Math.max(minWidth, startWidthRef.current + delta);
      onChange(next);
    },
    onPointerUp(e) {
      startX.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    },
  };
}
