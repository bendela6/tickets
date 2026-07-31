import { scaleFor } from '../view';

/**
 * How much room the artboard actually has inside the scrolling canvas region,
 * in CSS pixels — the number `zoomToFit` needs.
 *
 * It is measured rather than assumed. The stack under the canvas holds the
 * artboard, the transport and the held poses in a padded column, and how tall
 * that comes to depends on the document: a two-state icon carries a taller
 * transport than a one-state icon, and held poses appear only when there are
 * poses to hold. Subtracting a constant would make `fit` overflow on some
 * documents and undershoot on others.
 *
 * Height is exact because the column stacks: everything that is not the
 * artboard is `clientHeight` minus the artboard's own drawn height. Width is
 * only the padding — a sibling wider than the artboard does not take room
 * *from* it, it just makes the column wider than it needs to be.
 *
 * Returns null when there is nothing to measure — no elements yet, or a layout
 * with no size, which is what a test environment reports.
 */
export function canvasRoom(
  scroller: HTMLElement | null,
  stack: HTMLElement | null,
  artboard: { width: number; height: number },
  zoom: number,
): { width: number; height: number } | null {
  if (!scroller || !stack) return null;

  const style = getComputedStyle(stack);
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  if (!Number.isFinite(padX) || !Number.isFinite(padY)) return null;

  const drawnHeight = artboard.height * scaleFor(artboard, zoom);
  const below = Math.max(0, stack.clientHeight - padY - drawnHeight);

  const room = {
    width: scroller.clientWidth - padX,
    height: scroller.clientHeight - padY - below,
  };
  return room.width > 0 && room.height > 0 ? room : null;
}
