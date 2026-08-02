import type { Artboard, Pair } from './types';

/**
 * Values of record, transcribed from the design's prototype. Nothing here is a
 * guess and nothing here should be re-derived at a call site.
 */

/**
 * The artboard's LONGER on-screen edge at 100% zoom, in CSS pixels. The other
 * edge follows from the document's aspect, so a wide board stays wide.
 */
export const ARTBOARD_PX = 448;

/**
 * The board the design's placements are stated on. Where a new shape lands is a
 * number of units on a 512 artboard; on a 256 or 1024 board those scale by
 * `size / REFERENCE_SIZE`, so the same call produces the same picture at any
 * size. Without this a preset drawn for a 512 board would cover a quarter of a
 * 1024 one.
 */
export const REFERENCE_SIZE = 512;

/** How far from centre an object may reach before Android's circle crops it. */
export const SAFE_ZONE = 0.8;

/** Square presets, offered beside the two free-form fields. */
export const ARTBOARD_PRESETS: readonly Artboard[] = [
  { width: 16, height: 16 },
  { width: 64, height: 64 },
  { width: 256, height: 256 },
  { width: 512, height: 512 },
  { width: 1024, height: 1024 },
];

export const ARTBOARD_MIN = 1;
export const ARTBOARD_MAX = 4096;

/**
 * The zoom ladder the stepper walks and the wheel snaps to.
 *
 * It reaches much further than a percentage stepper normally would in both
 * directions, because the artboard is now any size: a 16 × 16 board needs to
 * be magnified to be drawn on at all, and a 4096 one needs to be shrunk to be
 * seen whole.
 */
export const ZOOM_LADDER: readonly number[] = [
  10, 25, 50, 75, 100, 150, 200, 300, 400, 600, 800, 1600,
];

export const ZOOM_MIN = ZOOM_LADDER[0] ?? 10;
export const ZOOM_MAX = ZOOM_LADDER[ZOOM_LADDER.length - 1] ?? 1600;

/** Snap steps offered as presets. Any positive number is legal. */
export const SNAP_PRESETS: readonly number[] = [0.5, 1, 2, 4, 8];
export const SNAP_MIN = 0.01;

/** Below this the grid is noise rather than guidance, so it thins out. */
export const MIN_GRID_PX = 8;

/** The eight one-click colours in the properties panel. */
export const SWATCHES: readonly string[] = [
  '#4E46C6',
  '#25231D',
  '#FFFFFF',
  '#F7F6F2',
  '#C0382E',
  '#C29A2E',
  '#2E7D4F',
  '#2E6FCC',
];

/** The colour a new object arrives in. */
export const DEFAULT_INK: Pair = { light: '#4E46C6', dark: '#A9A2F2' };

/** The artboard's own ground. */
export const DEFAULT_GROUND: Pair = { light: '#FFFFFF', dark: '#14130F' };
