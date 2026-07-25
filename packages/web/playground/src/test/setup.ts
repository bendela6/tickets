import { vi } from 'vitest';

// jsdom doesn't implement scrollIntoView; GalleryShell calls it to jump to a
// #slug--state anchor after selecting a component.
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? vi.fn();
}

// jsdom doesn't implement matchMedia; the sidebar asks it whether the window
// is too narrow to hold the sidebar in-flow. Defaults to "wide" (no match),
// which is the layout every existing test was written against; tests that
// care drive it through setViewportMatch() in sidebar.tsx.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom doesn't implement ResizeObserver; react-resizable-panels v4's <Group>
// constructs one unconditionally on mount (needed to drive real resizing,
// not just react to it), so the real-library smoke test in
// gallery-shell.test.tsx throws without a stub. The panels lib doesn't need
// real measurements to render its initial (percentage-based) layout.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
