import { useCallback, useLayoutEffect, useRef, useState, type RefCallback } from 'react';

/** What `useIsClipped` gives back: its state, then the ref for the box it measures. */
export interface UseIsClippedResult {
  /**
   * Whether the text runs past its box, sideways or down. `false` on a server,
   * until the box is measured, and while there is no box.
   */
  isClipped: boolean;
  /**
   * For the box that clips the text: the element with `overflow: hidden`, not
   * the text inside it. The same function for the hook's life.
   */
  ref: RefCallback<Element>;
}

/**
 * How far past its box text may run and still count as fitting, in pixels.
 * The scroll and client sizes are rounded to whole pixels, each its own way,
 * so a string that visibly fits can report itself a pixel over.
 */
const TOLERANCE = 1;

function overflows(box: Element): boolean {
  return (
    box.scrollWidth - box.clientWidth > TOLERANCE || box.scrollHeight - box.clientHeight > TOLERANCE
  );
}

// Every box measured on the page, and what measures each again. One observer
// watches them all, since a table can hold a few hundred of these and one
// observer of many elements costs less than many observers of one. It starts
// with the first box and ends with the last, so nothing is left running.
type Check = () => void;
const boxes = new Map<Element, Set<Check>>();
let observer: ResizeObserver | undefined;

function checkAll(): void {
  boxes.forEach((checks) => {
    checks.forEach((check) => check());
  });
}

/**
 * A late webfont changes how wide the text is and not how wide its box is, so
 * the observer never hears of it. A browser with no `document.fonts` has none.
 */
function fontsOf(): FontFaceSet | undefined {
  return typeof document !== 'undefined' && 'fonts' in document ? document.fonts : undefined;
}

function start(): void {
  // A browser with no ResizeObserver measures on mount and on a new text only.
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        boxes.get(entry.target)?.forEach((check) => check());
      });
    });
  }
  fontsOf()?.addEventListener('loadingdone', checkAll);
}

function stop(): void {
  observer?.disconnect();
  observer = undefined;
  fontsOf()?.removeEventListener('loadingdone', checkAll);
}

function watch(box: Element, check: Check): () => void {
  if (boxes.size === 0) {
    start();
  }
  const checks = boxes.get(box) ?? new Set<Check>();
  checks.add(check);
  if (!boxes.has(box)) {
    // Registered before it is observed: an observer may report at once.
    boxes.set(box, checks);
    observer?.observe(box);
  }
  return () => {
    checks.delete(check);
    if (checks.size === 0) {
      boxes.delete(box);
      observer?.unobserve(box);
    }
    if (boxes.size === 0) {
      stop();
    }
  };
}

/**
 * Whether a text overflows its box: `isClipped`, and the `ref` for the box.
 *
 * It measures the box when it mounts, before the browser paints, and again
 * when the box changes size, when `text` changes, and when a webfont loads.
 * Nothing is read on any other render, so a table's scroll reads no layout.
 *
 * @param text What the box shows: a new one is measured again, since it can
 *   change the overflow without changing the box's size.
 */
export function useIsClipped(text: string): UseIsClippedResult {
  const [isClipped, setIsClipped] = useState(false);
  const box = useRef<Element | null>(null);

  // A callback rather than an object, so a box that is swapped for another is
  // measured as it arrives. Measured at once, in the commit, so a box swapped
  // for one that clips the same reads the same, with no answer in between.
  const ref = useCallback<RefCallback<Element>>((node) => {
    if (!node) {
      return;
    }
    box.current = node;
    const check = () => {
      setIsClipped(overflows(node));
    };
    check();
    const unwatch = watch(node, check);
    return () => {
      unwatch();
      if (box.current === node) {
        box.current = null;
        setIsClipped(false);
      }
    };
  }, []);

  // `text` is what changes the overflow without changing the box: the box
  // keeps its width, and only the text inside it grows or shrinks.
  useLayoutEffect(() => {
    if (box.current) {
      setIsClipped(overflows(box.current));
    }
  }, [text]);

  return { isClipped, ref };
}
