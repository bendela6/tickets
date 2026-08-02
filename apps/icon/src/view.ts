import { ARTBOARD_PX, ZOOM_LADDER, ZOOM_MAX, ZOOM_MIN } from './doc/constants';
import type { Ground } from './doc/types';

/**
 * How the document is being *looked at*, as distinct from what it is. Nothing
 * here is saved with the document or entered into undo: changing the zoom is
 * not an edit, and neither is previewing the dark ground.
 */
export interface ViewState {
  zoom: number;
  grid: boolean;
  /**
   * Which half of every colour pair the artboard previews. Deliberately
   * independent of the UI theme — checking the dark icon should not mean
   * leaving a light workspace.
   */
  ground: Ground;
  /** A pointer is down on the artboard. */
  dragging: boolean;
  /** The safe-zone ring was pinned open from the warning chip. */
  safeZoneOpen: boolean;
}

export function initialView(): ViewState {
  return {
    zoom: 100,
    grid: true,
    ground: 'light',
    dragging: false,
    safeZoneOpen: false,
  };
}

/**
 * Hold the zoom inside its range, without rounding.
 *
 * A wheel zoom is continuous, so the stored value is fractional and only the
 * readout rounds. Rounding here would quantise the wheel to whole percent —
 * fine at 400%, a tenth of the range at 10%.
 */
export const clampZoom = (zoom: number): number =>
  Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));

/**
 * The next rung of the zoom ladder in `direction`.
 *
 * A ladder rather than a fixed 25% step, because the range now spans 10% to
 * 1600%: a fixed step would take sixty presses to cross it, and 25 percentage
 * points means something quite different at 25% than at 1600%.
 */
export function steppedZoom(zoom: number, direction: 1 | -1): number {
  const rungs = direction === 1 ? ZOOM_LADDER : [...ZOOM_LADDER].reverse();
  const next = rungs.find((rung) => (direction === 1 ? rung > zoom : rung < zoom));
  return next ?? clampZoom(zoom);
}

/** How many CSS pixels one document unit occupies at this zoom. */
export function scaleFor(artboard: { width: number; height: number }, zoom: number): number {
  const longest = Math.max(artboard.width, artboard.height);
  if (longest <= 0) return 1;
  return ((ARTBOARD_PX * zoom) / 100) / longest;
}

/**
 * The zoom that makes the artboard fill `room` without overflowing either axis.
 *
 * `room` is the space actually available, in CSS pixels: the caller has already
 * taken off its own padding and anything stacked below the artboard, so there
 * is no margin to guess at here. Both axes are solved rather than the smaller
 * viewport edge taken — that only fits a square board, and would have left a
 * 1024×256 document at a quarter of the zoom it had room for.
 */
export function zoomToFit(
  artboard: { width: number; height: number },
  room: { width: number; height: number },
): number {
  const longest = Math.max(artboard.width, artboard.height);
  if (longest <= 0 || artboard.width <= 0 || artboard.height <= 0) return 100;
  if (room.width <= 0 || room.height <= 0) return ZOOM_MIN;
  // `scaleFor` puts the longest edge at ARTBOARD_PX, so the zoom follows
  // directly from how many pixels that edge is allowed to take.
  const longestPx = Math.min(
    room.width * (longest / artboard.width),
    room.height * (longest / artboard.height),
  );
  // Floored, not rounded: zoom is a whole percent, and rounding up puts the
  // board back outside the room it was just fitted to.
  return clampZoom(Math.floor((longestPx / ARTBOARD_PX) * 100));
}

/**
 * Both rails, the top bar and the grid recede while the artboard is being
 * dragged on, so the artboard is briefly the only fully-lit thing on screen.
 */
export const chromeIsDim = (view: ViewState): boolean => view.dragging;
