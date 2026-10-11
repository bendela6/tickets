import { useEffect, useRef, useState } from 'react';

/**
 * Everything the engine has to MEASURE rather than derive, now that the table
 * no longer owns a scroll box.
 *
 * The table used to be a viewport-sized window with `overflow: auto`: it knew
 * its own height because a caller gave it one, and both scrollbars were its
 * own. It is now a full-height object sitting in a page that scrolls, which
 * means every number it needs belongs to somebody else — how tall the visible
 * area is, how far down the page the table starts, how wide its columns
 * actually resolved to. None of those can be computed; they have to be read
 * off the DOM after layout.
 */
export interface ScrollHost {
  /** The ancestor that actually scrolls. `null` until the first layout, and
   *  on a page with no scrolling ancestor at all. */
  el: HTMLElement | null;
  /** Distance from the host's content top to the table's frame. */
  frameTop: number;
  /** Distance from the host's content top to the first row — the virtualizer's
   *  `scrollMargin`, i.e. everything above the rows that is not rows: the page
   *  above the table, the frame's border, the column header. */
  rowsTop: number;
  /** The host's visible height. What "fill the rest of the viewport" measures
   *  against. */
  viewportHeight: number;
  /** The inner width of the clip box — how much of the table is on screen. */
  frameWidth: number;
  /** What the column tracks resolved to, totalled. The difference between this
   *  and `frameWidth` is how far the table can scroll sideways. */
  sheetWidth: number;
}

const EMPTY: ScrollHost = {
  el: null,
  frameTop: 0,
  rowsTop: 0,
  viewportHeight: 0,
  frameWidth: 0,
  sheetWidth: 0,
};

/** `overlay` is a legacy alias of `auto` that still shows up in computed
 *  styles; `scroll` and `auto` are the ones that matter. `hidden` is
 *  deliberately absent — it scrolls programmatically but nothing the user does
 *  moves it, so a table inside one would ride a scroll position that never
 *  changes. */
const SCROLLS = /^(auto|scroll|overlay)$/;

/**
 * The nearest ancestor that scrolls vertically.
 *
 * Walks up rather than taking the element from a prop because a table does not
 * know what it has been dropped into, and every caller would otherwise have to
 * thread a ref down from whichever layout component owns the scrolling — which
 * is usually the app shell, three or four levels above any page.
 *
 * Stops at `body`: a page that scrolls on the document has no scrolling
 * ELEMENT for the virtualizer to observe, and `null` is the honest answer,
 * handled by falling back to the window.
 */
function scrollHostOf(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (SCROLLS.test(getComputedStyle(node).overflowY)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Total the resolved column tracks.
 *
 * `getComputedStyle().gridTemplateColumns` on a grid gives the USED size of
 * every track in pixels, which is the only honest total: a column may be
 * `minmax(240px, 1fr)`, and adding up authored widths would miss by whatever
 * the flexible ones actually took. Reading it after paint costs nothing —
 * layout is already clean — whereas the same read during a commit forces a
 * synchronous re-layout, which is why every measurement here happens in a
 * passive effect.
 *
 * A track that does not parse as pixels (an empty string in jsdom, `none`
 * before the first layout) yields 0, which the caller reads as "no horizontal
 * overflow" — the right answer when nothing is known yet.
 */
function trackTotal(sheet: Element | null): number {
  // Down the first-child chain rather than at a fixed depth, because the grid
  // is not where you would first look for it: the render set's root only
  // PUBLISHES the track list (as a custom property every row inherits), and
  // the element that actually lays out on it is a row. Three levels covers
  // sheet → root → header row with a level to spare, and anything that does
  // not resolve to pixels simply reports nothing.
  let el: Element | null = sheet;
  for (let depth = 0; el && depth < 3; depth += 1) {
    const tracks = getComputedStyle(el).gridTemplateColumns;
    if (tracks && tracks !== 'none') {
      let total = 0;
      let parsed = true;
      for (const track of tracks.split(' ')) {
        const px = Number.parseFloat(track);
        if (Number.isNaN(px)) {
          parsed = false;
          break;
        }
        total += px;
      }
      if (parsed) {
        return Math.round(total);
      }
    }
    el = el.firstElementChild;
  }
  return 0;
}

function same(a: ScrollHost, b: ScrollHost): boolean {
  return (
    a.el === b.el &&
    a.frameTop === b.frameTop &&
    a.rowsTop === b.rowsTop &&
    a.viewportHeight === b.viewportHeight &&
    a.frameWidth === b.frameWidth &&
    a.sheetWidth === b.sheetWidth
  );
}

/**
 * Measure the table against whatever is scrolling it.
 *
 * Re-measures after every render (a passive effect with no dependency list —
 * the same shape, and for the same reason, as the scroll-edge read it sits
 * beside), plus on window resize and on any size change to the frame or the
 * host. Deliberately NOT on scroll: nothing here changes as the page moves,
 * because the sticky header, the pinned bands and the frozen columns are all
 * CSS now rather than arithmetic against a scroll offset. A table that
 * re-measured on every scroll frame would be doing layout reads during the
 * one interaction that can least afford them.
 *
 * The returned object is only replaced when a number actually changed, so the
 * post-render effect cannot loop.
 */
export function useScrollHost(
  frameEl: HTMLElement | null,
  clipEl: HTMLElement | null,
  sheetEl: HTMLElement | null,
  rowsEl: HTMLElement | null,
): ScrollHost {
  const [host, setHost] = useState<ScrollHost>(EMPTY);

  // What was last handed to `setHost`, checked BEFORE the setter is called
  // rather than inside it. A functional `setHost((prev) => same ? prev : next)`
  // is not the same thing: React can only skip scheduling when the fiber has
  // no update pending, and during a drag one always does — the next pointer
  // move has queued its offset before this effect runs. Every such no-op call
  // still counts as "setState inside useEffect" for React's nested-update
  // guard, and fifty of them in a row (under a second of dragging) log
  // "Maximum update depth exceeded" to the console.
  const latest = useRef<ScrollHost>(EMPTY);

  // Held in a ref so the subscription effect below can keep one identity for
  // the lifetime of the elements it listens to, while the measurement itself
  // stays current with whatever the last render produced. Re-subscribing a
  // ResizeObserver and a resize listener on every render is exactly the kind
  // of per-frame churn a column drag cannot afford.
  const measureRef = useRef(() => {});
  measureRef.current = () => {
    if (!frameEl) {
      if (latest.current !== EMPTY) {
        latest.current = EMPTY;
        setHost(EMPTY);
      }
      return;
    }
    const el = scrollHostOf(frameEl);
    const hostTop = el ? el.getBoundingClientRect().top : 0;
    const scrolled = el ? el.scrollTop : window.scrollY;
    const frameTop = Math.max(
      0,
      Math.round(frameEl.getBoundingClientRect().top - hostTop + scrolled),
    );
    const next: ScrollHost = {
      el,
      frameTop,
      // Falls back to the frame's own top until the row container exists — an
      // error, empty or loading table has no rows to place, and the
      // virtualizer is not running in any of those states anyway.
      rowsTop: rowsEl
        ? Math.max(0, Math.round(rowsEl.getBoundingClientRect().top - hostTop + scrolled))
        : frameTop,
      viewportHeight: Math.round(el ? el.clientHeight : window.innerHeight),
      frameWidth: clipEl?.clientWidth ?? 0,
      // Measured off the sheet's own subtree rather than through a ref, which
      // keeps the render contract free of an element the engine only wants to
      // look at.
      sheetWidth: trackTotal(sheetEl),
    };
    if (!same(latest.current, next)) {
      latest.current = next;
      setHost(next);
    }
  };

  // After every paint. No dependency list on purpose: a column resize, a page
  // of rows arriving and a density change all move these numbers without
  // changing anything this hook could list.
  useEffect(() => {
    measureRef.current();
  });

  useEffect(() => {
    const measure = () => measureRef.current();
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (observer && frameEl) {
      observer.observe(frameEl);
      const el = scrollHostOf(frameEl);
      if (el) {
        observer.observe(el);
      }
    }
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [frameEl]);

  return host;
}
