import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { isNarrowViewport, setNarrowViewport } from './viewport';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePreference;
  setNarrowViewport(false);
});

// The rail's tooltips are Radix, which measures with ResizeObserver; jsdom has none.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Nor scrollIntoView, which the search dialog calls to keep its lit row in view.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom has no matchMedia either. Every query answers "no" — a wide viewport
// and a light OS — except the max-width ones while a test has asked for a
// narrow viewport (viewport.ts).
window.matchMedia = (query: string) => {
  return {
    matches: isNarrowViewport() && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
};
