import type { Artboard, Pace, Pair, Ramp, Rest, Role, Speed, Sustain } from './types';

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
 * The board the design's distances are stated on. Every distance below is a
 * number of units on a 512 artboard; on a 256 or 1024 board they scale by
 * `size / REFERENCE_SIZE`, so the same document animates the same *shape* of
 * motion at any size. Without this a 1024 icon would travel half as far
 * relative to itself as a 512 one.
 */
export const REFERENCE_SIZE = 512;

/** How far from centre an object may reach before Android's circle crops it. */
export const SAFE_ZONE = 0.8;

/** A transition, in milliseconds at 1× speed. */
export const TRANSITION_MS = 400;

/** One turn of a sustained loop, in milliseconds at 1× speed. */
export const CYCLE_MS = 900;


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

export const ROLES: readonly Role[] = ['spins', 'moves', 'fades'];

export const ROLE_HINTS: Record<Role, string> = {
  spins: 'turns — between states, and around the loop',
  moves: 'travels between its position in each state',
  fades: 'crossfades between its opacity in each state',
};

export const PACES: readonly Pace[] = [0.5, 1, 2, 3];
export const SPEEDS: readonly Speed[] = [0.5, 1, 1.5, 2];
export const RAMPS: readonly Ramp[] = ['linear', 'soft', 'sharp'];

export const RESTS: readonly Rest[] = [0, 0.08, 0.18];
export const REST_LABELS: Record<Rest, string> = { 0: 'none', 0.08: 'even', 0.18: 'wide' };

/** The cycle order of the settled/sustained button. */
export const SUSTAINS: readonly Sustain[] = [null, 'turning', 'pulsing', 'travelling'];

/**
 * How much of each role a sustained state drives. A `turning` state spins at
 * full amplitude and only nudges the others; `pulsing` is the same statement
 * about opacity, `travelling` about position.
 */
export const SUSTAIN_AMPLITUDE: Record<Exclude<Sustain, null>, Record<Role, number>> = {
  turning: { spins: 1, moves: 0.3, fades: 0.3 },
  pulsing: { spins: 0.14, moves: 0.2, fades: 1 },
  travelling: { spins: 0.18, moves: 1, fades: 0.3 },
};

/**
 * How far each role travels across a full transition. Fixed by design: motion
 * is tuned through role, pace and document timing, never through a per-object
 * amplitude — there is no control for these and there must not be one.
 */
export const TRANSITION_SPIN_DEGREES = 110;
export const TRANSITION_MOVE_UNITS = 92;
export const TRANSITION_FADE_PERCENT = 58;

/** How far a sustained loop swings each role at full amplitude. */
export const LOOP_SPIN_DEGREES = 360;
export const LOOP_MOVE_UNITS = 24;
export const LOOP_FADE_PERCENT = 34;
/** A loop never fades an object entirely away. */
export const LOOP_MIN_OPACITY = 14;

/** The colour a new object arrives in. */
export const DEFAULT_INK: Pair = { light: '#4E46C6', dark: '#A9A2F2' };

/** The artboard's own ground. */
export const DEFAULT_GROUND: Pair = { light: '#FFFFFF', dark: '#14130F' };
