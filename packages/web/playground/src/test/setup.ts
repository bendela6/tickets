import { vi } from 'vitest';

// jsdom doesn't implement scrollIntoView; GalleryShell calls it to jump to a
// #slug--state anchor after selecting a component.
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? vi.fn();
}
