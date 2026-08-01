/**
 * The document model.
 *
 * Two rules hold everywhere and are the reason most of this file is shaped the
 * way it is:
 *
 * 1. **Every colour is a pair.** A favicon inherits no colour from the page it
 *    sits on, so a single hex cannot describe one. There is no indirection —
 *    no named palette, no references — you pick two colours, and the platform
 *    swaps them on `prefers-color-scheme`.
 * 2. **Objects are ordered front-to-back.** `objects[0]` is the frontmost, the
 *    way a layers list reads. The renderer paints in reverse.
 */

/** A colour, which is always two colours. */
export interface Pair {
  light: string;
  dark: string;
}

/** Which half of a pair is currently being previewed and edited. */
export type Ground = 'light' | 'dark';

/** A position in document units. Lives here because `Geometry` is stated in them. */
export interface Point {
  x: number;
  y: number;
}

/**
 * The shapes a document may hold.
 *
 * Every one of these is an SVG element, and that is the whole of the rule: a
 * document cannot contain something the format it exports to has no name for.
 * A regular n-gon is not on the list — SVG's `<polygon>` is a list of points
 * and nothing else — so a hexagon is a preset that *makes* a point list rather
 * than a kind that remembers being regular.
 */
export type ShapeKind = 'rect' | 'circle' | 'ellipse' | 'line' | 'polyline' | 'polygon';

/**
 * Geometry, per kind. A line is stored as two endpoints rather than a box
 * because a box cannot say which way it runs, and a circle as a centre and a
 * radius because that is what keeps it circular under resize.
 *
 * A rect and an ellipse are both stored as boxes even though `<ellipse>` is
 * written as a centre and two radii: which element a shape *is* and how its
 * attributes are encoded are separate questions, and the renderer converts.
 */
export type Geometry =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; radius: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'ellipse'; x: number; y: number; w: number; h: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'polyline'; points: Point[] }
  | { kind: 'polygon'; points: Point[] };

export type Role = 'spins' | 'moves' | 'fades';

/** Relative running order. Higher leads. */
export type Pace = 0.5 | 1 | 2 | 3;

export interface Motion {
  /** Off means the object holds its first-state pose in every state. */
  takesPart: boolean;
  role: Role;
  /** Pace IS the running order — there is no separate ordering control. */
  pace: Pace;
}

export interface IconObject {
  id: string;
  name: string;
  geometry: Geometry;
  fill: Pair;
  stroke: Pair;
  strokeWidth: number;
  /** 0–100. Stored as the number the properties panel shows. */
  opacity: number;
  /** Degrees, about the object's own centre. */
  rotation: number;
  hidden: boolean;
  locked: boolean;
  motion: Motion;
}

/**
 * What a sustained state does while you stay in it. `null` is a settled
 * state — a static pose with an end.
 */
export type Sustain = null | 'turning' | 'pulsing' | 'travelling';

export interface IconState {
  id: string;
  name: string;
  sustain: Sustain;
}

export type Speed = 0.5 | 1 | 1.5 | 2;
export type Ramp = 'linear' | 'soft' | 'sharp';
/** How far apart the objects' pauses are pushed, so they never all stop at once. */
export type Rest = 0 | 0.08 | 0.18;

export interface Timing {
  speed: Speed;
  ramp: Ramp;
  rest: Rest;
}

export interface Artboard {
  width: number;
  height: number;
}

export interface IconDoc {
  name: string;
  /** The artboard, in document units. Not required to be square. */
  artboard: Artboard;
  /**
   * The grid every position and size lands on, in document units.
   *
   * A property of the document rather than of the view: on a 16 × 16 board a
   * step of 1 is the difference between a drawable icon and one whose edges
   * fall between pixels, and that has to survive being saved and reopened.
   * `1` means whole units only; `0.5` allows halves; `8` snaps to eighths of a
   * 64-unit board.
   */
  snap: number;
  background: Pair;
  /** Front-to-back. `objects[0]` is frontmost. */
  objects: IconObject[];
  /** Never empty: one state is a legal document. */
  states: IconState[];
  timing: Timing;
}

/** An object with its pose for some moment resolved onto it. */
export type PosedObject = IconObject;

export interface DocumentSummary {
  id: string;
  name: string;
  artboard: Artboard;
  updatedAt: number;
}
