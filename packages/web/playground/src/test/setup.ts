import { vi } from 'vitest';

// jsdom doesn't implement scrollIntoView; GalleryShell calls it to jump to a
// #slug--state anchor after selecting a component.
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? vi.fn();
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
