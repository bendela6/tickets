import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom gaps that radix-ui overlays (Popover, Tooltip, Dialog, …) rely on.
//
// @tickets/table's virtualizer (useVirtualizer) also measures its scroll
// container via ResizeObserver. jsdom does no layout, so a real
// ResizeObserver would never fire and the container would stay 0x0 forever —
// the virtualizer would then compute an empty visible range and every
// virtualized row/group would be missing from the DOM, even though the
// engine is correct (see @tickets/ui's table-render.test.tsx, which hits the
// same gap locally). Firing synchronously — but ONLY for the table's own
// scroll node, tagged `data-slot="table-scroll"` in Table.tsx — gives the
// virtualizer a real size while every other ResizeObserver consumer (radix
// popovers/tooltips/etc.) keeps the previous no-op behaviour.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      if (target.getAttribute('data-slot') !== 'table-scroll') {
        return;
      }
      this.cb(
        [
          {
            target,
            contentRect: { width: 1000, height: 400 } as DOMRectReadOnly,
            borderBoxSize: [{ inlineSize: 1000, blockSize: 400 }] as ResizeObserverSize[],
            contentBoxSize: [{ inlineSize: 1000, blockSize: 400 }] as ResizeObserverSize[],
            devicePixelContentBoxSize: [] as ResizeObserverSize[],
          },
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  };
}

if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? vi.fn();
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? vi.fn();
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? vi.fn();
  // jsdom implements getBoundingClientRect but not getClientRects. ProseMirror's
  // scrollToSelection (run after any transaction that moves the caret, e.g. real
  // typing into a RichTextEditor via userEvent) calls it unconditionally on the
  // target node/Range and throws if it's missing — an empty rect list is enough
  // to keep that scroll-into-view step a no-op instead of an uncaught exception.
  Element.prototype.getClientRects = Element.prototype.getClientRects ?? (() => [] as unknown as DOMRectList);
}
if (typeof Range !== 'undefined') {
  const zeroRect = () =>
    ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      toJSON() {
        return this;
      },
    }) as DOMRect;
  Range.prototype.getClientRects = Range.prototype.getClientRects ?? (() => [] as unknown as DOMRectList);
  Range.prototype.getBoundingClientRect = Range.prototype.getBoundingClientRect ?? zeroRect;
}

// jsdom doesn't implement elementFromPoint. ProseMirror's mousedown handler
// (posAtCoords, used to resolve a click to a document position so the editor
// can focus + place the cursor) calls it unconditionally and throws if it's
// missing entirely — a conservative "nothing there" stub keeps that click
// path working without pretending to do real hit-testing.
if (typeof document !== 'undefined' && typeof document.elementFromPoint === 'undefined') {
  document.elementFromPoint = () => null;
}

// jsdom has no matchMedia — xterm's CoreBrowserService reads it on construction
// (devicePixelRatio tracking) even in tests that never touch real media queries.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
