import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { wheelIntent, zoomByWheel } from './navigation';

/** Which mouse button is the wheel pressed as a button. */
const MIDDLE_BUTTON = 1;

interface Anchor {
  /** Where the pointer was, in client space. */
  clientX: number;
  clientY: number;
  /** The document point that was under it, which must still be under it after. */
  x: number;
  y: number;
}

/**
 * Getting around the canvas: wheel to zoom, middle-drag or two fingers to pan.
 *
 * Everything here is a native listener on the scrolling element rather than a
 * React prop, for two reasons. `wheel` has to be registered non-passively or
 * `preventDefault` is ignored and the browser zooms the page instead. And a
 * pan is a stream of events that must not re-render anything — it only moves
 * `scrollLeft`, which React does not own.
 */
export function useCanvasNavigation({
  scrollerRef,
  boardRef,
  scale,
  zoom,
  onZoom,
}: {
  /** The element that scrolls. */
  scrollerRef: RefObject<HTMLElement | null>;
  /** The artboard itself, so a zoom can be anchored to a point on it. */
  boardRef: RefObject<HTMLElement | null>;
  /** CSS pixels per document unit at the current zoom. */
  scale: number;
  zoom: number;
  onZoom: (next: number) => void;
}): void {
  const anchor = useRef<Anchor | null>(null);
  const panFrom = useRef<{ x: number; y: number } | null>(null);

  // The listeners are registered once, so they must not close over a stale
  // zoom: a burst of wheel events inside one frame would otherwise all read
  // the same starting value and only the last would survive.
  const live = useRef({ scale, zoom, onZoom });
  live.current = { scale, zoom, onZoom };

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onWheel = (event: WheelEvent) => {
      // Either way the browser must not act on this itself — it would zoom the
      // page on ⌘+wheel and scroll the document on the rest.
      event.preventDefault();

      if (wheelIntent(event) === 'pan') {
        scroller.scrollLeft += event.deltaX;
        scroller.scrollTop += event.deltaY;
        return;
      }

      // Remember what was under the cursor. The correction happens after the
      // layout, because where that point lands depends on padding, centring
      // and whether a scrollbar appeared — none of which is worth modelling
      // when it can simply be measured.
      const board = boardRef.current?.getBoundingClientRect();
      if (board && live.current.scale > 0) {
        anchor.current = {
          clientX: event.clientX,
          clientY: event.clientY,
          x: (event.clientX - board.left) / live.current.scale,
          y: (event.clientY - board.top) / live.current.scale,
        };
      }
      live.current.onZoom(zoomByWheel(live.current.zoom, event.deltaY));
    };

    // Windows Chrome opens its autoscroll widget on a middle press, and only
    // preventing the *mouse* event stops it.
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === MIDDLE_BUTTON) event.preventDefault();
    };
    const onAuxClick = (event: MouseEvent) => {
      if (event.button === MIDDLE_BUTTON) event.preventDefault();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== MIDDLE_BUTTON) return;
      event.preventDefault();
      panFrom.current = { x: event.clientX, y: event.clientY };
      scroller.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      const from = panFrom.current;
      if (!from) return;
      // The canvas follows the hand, so the content moves with the pointer and
      // the scroll offset moves against it.
      scroller.scrollLeft -= event.clientX - from.x;
      scroller.scrollTop -= event.clientY - from.y;
      panFrom.current = { x: event.clientX, y: event.clientY };
    };

    const endPan = (event: PointerEvent) => {
      if (!panFrom.current) return;
      panFrom.current = null;
      if (scroller.hasPointerCapture(event.pointerId)) {
        scroller.releasePointerCapture(event.pointerId);
      }
    };

    scroller.addEventListener('wheel', onWheel, { passive: false });
    scroller.addEventListener('mousedown', onMouseDown);
    scroller.addEventListener('auxclick', onAuxClick);
    scroller.addEventListener('pointerdown', onPointerDown);
    scroller.addEventListener('pointermove', onPointerMove);
    scroller.addEventListener('pointerup', endPan);
    scroller.addEventListener('pointercancel', endPan);
    return () => {
      scroller.removeEventListener('wheel', onWheel);
      scroller.removeEventListener('mousedown', onMouseDown);
      scroller.removeEventListener('auxclick', onAuxClick);
      scroller.removeEventListener('pointerdown', onPointerDown);
      scroller.removeEventListener('pointermove', onPointerMove);
      scroller.removeEventListener('pointerup', endPan);
      scroller.removeEventListener('pointercancel', endPan);
    };
  }, [boardRef, scrollerRef]);

  /**
   * Put the anchored document point back under the cursor.
   *
   * Runs after every render rather than on a dependency, because the anchor
   * must be consumed even when the zoom was clamped and nothing moved —
   * otherwise it would be applied to the *next* gesture instead.
   *
   * The correction is a scroll, so it only has somewhere to go once the
   * artboard is larger than the region. While the whole board still fits, a
   * zoom necessarily grows about the centre and the cursor drifts; measured,
   * that window is 100%–160% on a 512 board and the anchor holds to within a
   * third of a pixel above it. Closing it entirely means giving up the
   * scroller for a transformed viewport, which is a different design.
   */
  useLayoutEffect(() => {
    const pending = anchor.current;
    anchor.current = null;
    if (!pending) return;
    const scroller = scrollerRef.current;
    const board = boardRef.current;
    if (!scroller || !board) return;

    const rect = board.getBoundingClientRect();
    const nowX = rect.left + pending.x * live.current.scale;
    const nowY = rect.top + pending.y * live.current.scale;
    scroller.scrollLeft += nowX - pending.clientX;
    scroller.scrollTop += nowY - pending.clientY;
  });
}
