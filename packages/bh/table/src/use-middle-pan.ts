import { useEffect, useRef, useState } from 'react';

/**
 * Middle-click autoscroll, implemented rather than inherited.
 *
 * The browser gives this gesture away for free — press the wheel, move the
 * mouse, the page scrolls both ways — but only on a real scroll container. The
 * table's clip box is deliberately not one (that is what keeps the header
 * sticky against the page), so Chrome finds nothing to autoscroll sideways and
 * the gesture dies over the one element it is most wanted on.
 *
 * So it is rebuilt here, both axes together. Both, and not just the missing
 * one: taking over the middle button means the native gesture never starts, so
 * a table that only panned horizontally would have silently BROKEN vertical
 * autoscroll over itself.
 *
 * Two modes, the same two the platform has:
 *
 * - **Hold and drag** — press, move, release. Panning stops on release.
 * - **Click and go** — press and release without moving. Panning continues
 *   with the pointer free, until the next click, `Escape`, or a wheel.
 *
 * Which one you are in is decided at release: a pointer that travelled past
 * `DEAD_ZONE` was a drag, anything less was a click.
 */

/** How far from the origin before anything moves, in pixels. Without it, a
 *  click that lands a pixel off its own start would creep. */
const DEAD_ZONE = 12;

/** Divides the distance from the origin to get pixels per frame. Smaller is
 *  faster; 9 gives roughly a screen a second at 100px out, which is about what
 *  the platform's own autoscroll does. */
const SPEED_DIVISOR = 9;

/** Pixels per frame, from how far the pointer is from where the gesture
 *  started. Linear past the dead zone — the further out, the faster, which is
 *  the whole idea of autoscroll. */
function velocity(distance: number): number {
  const past = Math.abs(distance) - DEAD_ZONE;
  if (past <= 0) {
    return 0;
  }
  return (Math.sign(distance) * past) / SPEED_DIVISOR;
}

export function useMiddlePan(options: {
  /** Where the gesture is picked up — the table's clip box. */
  el: HTMLElement | null;
  /** The element that scrolls vertically, or null for the document. */
  scrollHost: HTMLElement | null;
  /** Pixels to move the table sideways this frame. The caller clamps. */
  onPanX: (dx: number) => void;
}): boolean {
  const { el, scrollHost, onPanX } = options;
  const [panning, setPanning] = useState(false);

  // Read inside the rAF loop and the window listeners, which are installed
  // once per gesture and must not close over a stale render's callback.
  const panXRef = useRef(onPanX);
  panXRef.current = onPanX;
  const hostRef = useRef(scrollHost);
  hostRef.current = scrollHost;

  useEffect(() => {
    if (!el) {
      return;
    }
    // The pointer's offset from where the gesture started. Written by the move
    // listeners, read by the frame loop — a ref and not state, because it
    // changes at pointer rate and nothing renders on it.
    const offset = { x: 0, y: 0 };
    let origin: { x: number; y: number } | null = null;
    let travelled = false;
    let frame = 0;

    const scrollBy = (dy: number) => {
      const host = hostRef.current;
      if (host) {
        host.scrollTop += dy;
        return;
      }
      window.scrollBy(0, dy);
    };

    const tick = () => {
      const dx = velocity(offset.x);
      const dy = velocity(offset.y);
      if (dx !== 0) {
        panXRef.current(dx);
      }
      if (dy !== 0) {
        scrollBy(dy);
      }
      frame = requestAnimationFrame(tick);
    };

    const track = (e: PointerEvent | MouseEvent) => {
      if (!origin) {
        return;
      }
      offset.x = e.clientX - origin.x;
      offset.y = e.clientY - origin.y;
      if (Math.abs(offset.x) > DEAD_ZONE || Math.abs(offset.y) > DEAD_ZONE) {
        travelled = true;
      }
    };

    const stop = () => {
      if (!origin) {
        return;
      }
      origin = null;
      offset.x = 0;
      offset.y = 0;
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointerdown', stopSticky, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('wheel', stop, true);
      setPanning(false);
    };

    // In click-and-go mode the next press of ANY button ends it, which is what
    // the platform does — and it must not also start a new gesture, so this
    // runs in the capture phase and swallows the event.
    const stopSticky = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      stop();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stop();
      }
    };

    const onPointerUp = () => {
      if (travelled) {
        // It was a drag: the gesture ends with the button.
        stop();
        return;
      }
      // It was a click: keep panning with the pointer free, and listen for
      // whatever ends it.
      window.removeEventListener('pointerup', onPointerUp);
      window.addEventListener('pointerdown', stopSticky, true);
      window.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('wheel', stop, true);
    };

    const onPointerDown = (e: PointerEvent) => {
      // 1 is the middle button. Anything else is somebody else's gesture.
      if (e.button !== 1 || origin) {
        return;
      }
      // Stops the browser's own autoscroll from starting on top of this one —
      // and on Linux, a middle-click paste. This is why the listener is
      // registered non-passively.
      e.preventDefault();
      origin = { x: e.clientX, y: e.clientY };
      offset.x = 0;
      offset.y = 0;
      travelled = false;
      setPanning(true);
      window.addEventListener('pointermove', track);
      window.addEventListener('pointerup', onPointerUp);
      frame = requestAnimationFrame(tick);
    };

    /**
     * Belt and braces against the native gesture.
     *
     * Preventing `pointerdown` is supposed to suppress the compatibility mouse
     * events that follow, and Chrome starts autoscroll from `mousedown` — but
     * "supposed to" is doing a lot of work in a rule that differs between
     * engines, and the failure mode is the browser's anchor icon appearing on
     * top of our own pan. `auxclick` goes with it: that is the event a middle
     * click fires on release, and on Linux it is also a paste.
     */
    const swallow = (e: globalThis.MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    el.addEventListener('mousedown', swallow, { passive: false });
    el.addEventListener('auxclick', swallow, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('mousedown', swallow);
      el.removeEventListener('auxclick', swallow);
      stop();
    };
  }, [el]);

  return panning;
}
