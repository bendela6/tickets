import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// jsdom gaps that radix-ui overlays (Popover, Tooltip, Dialog, Menu, Toast)
// rely on. Mirrors apps/web/src/test/setup.ts, minus the ProseMirror and xterm
// stubs — neither library is a dependency of this package.
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
  Element.prototype.getClientRects =
    Element.prototype.getClientRects ?? (() => [] as unknown as DOMRectList);
}

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
