import '@testing-library/jest-dom/vitest';

/**
 * Pointer capture, which jsdom does not implement at all.
 *
 * Every drag in the editor takes it, so that a pointer which leaves the handle
 * it started on keeps feeding the same gesture rather than the drag dying the
 * moment you move faster than React re-renders. Nothing here emulates that — a
 * test dispatches its own events wherever it likes — so these only have to
 * exist and remember what they were told.
 *
 * Stated as an environment gap rather than guarded against in the editor:
 * pointer capture is not optional in a browser, and code written around a
 * missing browser feature would be code with no reason to exist in production.
 */
const captured = new WeakMap<Element, Set<number>>();

if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function setPointerCapture(
    this: Element,
    pointerId: number,
  ): void {
    const held = captured.get(this) ?? new Set<number>();
    held.add(pointerId);
    captured.set(this, held);
  };
  Element.prototype.releasePointerCapture = function releasePointerCapture(
    this: Element,
    pointerId: number,
  ): void {
    captured.get(this)?.delete(pointerId);
  };
  Element.prototype.hasPointerCapture = function hasPointerCapture(
    this: Element,
    pointerId: number,
  ): boolean {
    return captured.get(this)?.has(pointerId) ?? false;
  };
}
