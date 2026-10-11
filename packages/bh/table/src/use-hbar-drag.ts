import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface HbarHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
}

export interface HbarDrag {
  /** True from pointer-down on the thumb until the pointer is released. The
   *  render set uses it to hold the bar visible and darken the thumb. */
  dragging: boolean;
  /** Spread onto the thumb. */
  thumbProps: HbarHandlers;
  /** Spread onto the track, for click-to-jump. */
  trackProps: Pick<HbarHandlers, 'onPointerDown'>;
}

/**
 * Dragging a drawn scrollbar.
 *
 * The bar is not a scroll container any more, so none of this comes free: the
 * thumb's travel and the table's travel are different distances, and the ratio
 * between them is what turns a pointer into an offset. Everything here is that
 * one conversion plus the bookkeeping to keep a drag alive while the pointer
 * leaves the thumb.
 *
 * Pointer capture rather than window listeners, for the reason every drag
 * wants it: the thumb keeps receiving moves once the pointer has slid off it,
 * and the browser cleans up if the gesture is interrupted. It is called
 * defensively because jsdom implements neither half of the API and a test
 * renderer should not have to.
 */
export function useHbarDrag(options: {
  /** How far the table is scrolled now. */
  sx: number;
  /** How far it can scroll in total. */
  maxSx: number;
  /** How far the THUMB can travel: the track's width less the thumb's own. */
  span: number;
  thumbWidth: number;
  onChange: (sx: number) => void;
}): HbarDrag {
  const { sx, maxSx, span, thumbWidth, onChange } = options;
  const start = useRef<{ x: number; sx: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Pixels of table per pixel of thumb. A span of zero means the thumb fills
  // the track, which only happens when there is nothing to scroll.
  const ratio = span > 0 ? maxSx / span : 0;
  const clamp = (next: number) => Math.max(0, Math.min(maxSx, Math.round(next)));

  const end = (e: ReactPointerEvent<HTMLElement>) => {
    if (!start.current) {
      return;
    }
    start.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return {
    dragging,
    thumbProps: {
      onPointerDown: (e) => {
        if (ratio === 0) {
          return;
        }
        // Stops the track's own handler from also firing and jumping the
        // table to wherever the thumb was grabbed.
        e.stopPropagation();
        e.preventDefault();
        start.current = { x: e.clientX, sx };
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e) => {
        if (!start.current) {
          return;
        }
        onChange(clamp(start.current.sx + (e.clientX - start.current.x) * ratio));
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
    trackProps: {
      // Clicking the track centres the thumb where you clicked, which is what
      // every native scrollbar on this platform does with a primary click.
      onPointerDown: (e) => {
        if (ratio === 0) {
          return;
        }
        const track = e.currentTarget.getBoundingClientRect();
        onChange(clamp((e.clientX - track.left - thumbWidth / 2) * ratio));
      },
    },
  };
}
