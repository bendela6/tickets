import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/** Where the tile has to sit, in pixels inside the group's padding box. */
export interface SegmentTile {
  left: number;
  width: number;
}

/**
 * The tile's geometry, measured from the segment it covers.
 *
 * Equal-width segments used to make this arithmetic: the nth of n got
 * `n * 100/n%` and nothing had to be read out of the DOM. That arithmetic is
 * exactly what forced every segment to the width of the longest label, so the
 * measurement is the price of letting a segment be as wide as its own word.
 *
 * `offsetLeft` is reported from the offsetParent's PADDING edge, which is also
 * where `left` starts for an absolutely-positioned child of that same parent —
 * so the number transfers across with no correction for the group's padding.
 *
 * Measuring in a layout effect rather than an effect is what keeps the tile
 * from being seen at the wrong place: the browser paints once, already correct.
 * Nothing is drawn until the first measurement lands, so the tile appears in
 * position instead of gliding in from the left edge on mount.
 */
export function useSegmentTile(selected: string | null, revision: string) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const segments = useRef(new Map<string, HTMLButtonElement>());
  const [tile, setTile] = useState<SegmentTile | null>(null);

  const registerSegment = useCallback((value: string, node: HTMLButtonElement | null) => {
    if (node) {
      segments.current.set(value, node);
    } else {
      segments.current.delete(value);
    }
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const node = selected === null ? undefined : segments.current.get(selected);
      if (!node) {
        setTile(null);
        return;
      }
      const next = { left: node.offsetLeft, width: node.offsetWidth };
      // Same numbers, same object: a ResizeObserver that fires on every
      // scrollbar and theme change must not re-render the group for nothing.
      setTile((previous) => {
        return previous?.left === next.left && previous.width === next.width ? previous : next;
      });
    };

    measure();

    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') {
      return;
    }
    // Both the group and the segments: the group catches the width it is given
    // changing, and the segments catch their own labels changing under it —
    // a late webfont, a translated string — which a fixed-width group cannot
    // report on their behalf.
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    segments.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [selected, revision]);

  return { listRef, registerSegment, tile };
}
