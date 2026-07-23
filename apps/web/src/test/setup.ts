import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom gaps that radix-ui overlays (Popover, Tooltip, Dialog, …) rely on.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? vi.fn();
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? vi.fn();
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? vi.fn();
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
