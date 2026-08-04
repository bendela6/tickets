/**
 * How much room the artboard actually has inside the scrolling canvas region,
 * in CSS pixels — the number `zoomToFit` needs.
 *
 * The padding is read off the stack rather than restated here, so a change to
 * the column's spacing cannot leave `fit` overflowing by exactly the amount
 * nobody updated. It is asymmetric — the bottom clears the canvas footer — so
 * both edges are measured rather than one doubled.
 *
 * Returns null when there is nothing to measure — no elements yet, or a layout
 * with no size, which is what a test environment reports.
 */
export function canvasRoom(
  scroller: HTMLElement | null,
  stack: HTMLElement | null,
): { width: number; height: number } | null {
  if (!scroller || !stack) return null;

  const style = getComputedStyle(stack);
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  if (!Number.isFinite(padX) || !Number.isFinite(padY)) return null;

  const room = {
    width: scroller.clientWidth - padX,
    height: scroller.clientHeight - padY,
  };
  return room.width > 0 && room.height > 0 ? room : null;
}
