import { clampZoom } from '../view';

/** What a wheel event was meant to do. */
export type WheelIntent = 'zoom' | 'pan';

/**
 * A mouse wheel reports whole detents — 100 pixels per notch in Chrome, and
 * never a horizontal component. Anything smaller, fractional or sideways came
 * from a trackpad tracking fingers continuously.
 */
const DETENT_PX = 40;

/** How fast the wheel zooms. At 100px per notch this doubles in ~3.5 notches. */
const WHEEL_RATE = 0.002;

export interface WheelSignal {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * Whether a wheel event should zoom or pan.
 *
 * The wheel zooms — that is the choice for this app, and what most drawing
 * tools do. But a trackpad's two-finger scroll arrives as a wheel event too,
 * and there it has to pan, so the two have to be told apart with no flag that
 * says which device sent it.
 *
 * The signals that work in practice: a pinch arrives with `ctrlKey` set,
 * because browsers synthesise it that way; a two-finger scroll reports a
 * horizontal component, or a fractional or small vertical one; a mouse wheel
 * reports whole detents straight down.
 *
 * It is a heuristic and it can be wrong — a high-resolution wheel emitting
 * fractional deltas will pan when it meant to zoom. Holding ⌘/Ctrl always
 * zooms, which is the escape hatch, and it is why that check comes first.
 */
export function wheelIntent(event: WheelSignal): WheelIntent {
  if (event.ctrlKey || event.metaKey) return 'zoom';
  // Lines or pages rather than pixels: only a classic wheel reports those.
  if (event.deltaMode !== 0) return 'zoom';
  if (event.deltaX !== 0) return 'pan';
  if (!Number.isInteger(event.deltaY)) return 'pan';
  return Math.abs(event.deltaY) >= DETENT_PX ? 'zoom' : 'pan';
}

/**
 * The zoom a wheel notch lands on.
 *
 * Multiplicative rather than additive: ten percentage points is a tenth of the
 * range at 100% and a hundredth at 1000%, so an additive step feels like a
 * different gesture at each end. A constant *ratio* per notch feels the same
 * everywhere, which is what makes the zoom read as smooth.
 */
export function zoomByWheel(zoom: number, deltaY: number): number {
  return clampZoom(zoom * Math.exp(-deltaY * WHEEL_RATE));
}
