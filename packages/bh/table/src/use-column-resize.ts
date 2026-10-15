import type { PointerEvent as ReactPointerEvent } from 'react';
import { useDrag } from '@bh/hooks';

/** `useColumnResize`'s options: the width a drag starts from, its floor, and
 *  where the widths go. */
export interface UseColumnResizeOptions {
  /** The width to drag from when the handle's cell can't be measured. Inside
   *  a header cell carrying `data-cell-col`, the cell is measured instead. */
  startWidth: number;
  /** The narrowest the drag goes, in pixels: 64 without one. */
  minWidth?: number;
  /** Called with the new width on every pointer move of a drag. */
  onChange: (px: number) => void;
}

/** Pointer handlers to spread onto a resize handle. */
export interface UseColumnResizeHandlers {
  /** Starts a drag: captures the pointer and measures the starting width. */
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  /** Reports the width the drag has reached, while one is running. */
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  /** Ends the drag. */
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  /** Ends the drag when the browser takes the pointer. */
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  /** Ends the drag when the handle loses the pointer it captured. */
  onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => void;
}

/**
 * The width the drag actually starts from, measured off the header cell.
 *
 * `startWidth` is a GUESS, and it says so: a column laid out as `1fr` or
 * `minmax(240px, 1fr)` has no pixel width to read off the column definition,
 * so `startWidthOf` hands over a 160px fallback. Anchoring the drag to that
 * fallback is what made a flexible column JUMP to ~160px on the first
 * pointermove and only track the pointer afterwards — the grab point and the
 * column's real width disagreed by however wide `1fr` had resolved.
 *
 * The DOM is the only thing that knows, which is the same conclusion
 * `autoFitColumn` reached. `data-cell-col` is the anchor because the engine
 * already REQUIRES it on every header cell (it is how focus finds a cell again
 * after virtualization remounts it), so this needs no new contract and no
 * assumption about how the render set nests the handle inside the cell.
 *
 * Falls back to `startWidth` when there is nothing to measure — a detached
 * handle, or jsdom, where every rect is 0×0.
 */
function measuredWidth(handle: Element): number | null {
  const cell = handle.closest<HTMLElement>('[data-cell-col]');
  const width = cell ? cell.getBoundingClientRect().width : 0;
  return width > 0 ? Math.round(width) : null;
}

/**
 * The drag behind a column's resize handle: spread what it returns onto the
 * handle, and `onChange` is called with the width as the pointer moves. The
 * drag starts from the header cell's measured width, and goes no narrower
 * than `minWidth`.
 *
 * @param opts The width to start from, the floor, and where widths go.
 */
export function useColumnResize(opts: UseColumnResizeOptions): UseColumnResizeHandlers {
  const { startWidth, minWidth = 64, onChange } = opts;
  // @bh/hooks' drag: the handle captures the pointer, and each move is
  // measured from where it went down.
  const drag = useDrag<number>({
    onStart: ({ event }) => measuredWidth(event.currentTarget) ?? startWidth,
    onMove: ({ dx, from }) => onChange(Math.max(minWidth, from + dx)),
  });
  return drag.getHandleProps();
}
