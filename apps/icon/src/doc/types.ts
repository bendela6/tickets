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
export type ShapeKind =
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'polygon'
  | 'path';

/**
 * One command of a path, in the absolute form only.
 *
 * SVG also writes each of these relative (lowercase) and offers the shorthands
 * `H`, `V`, `S` and `T`. Storing all of them would make every consumer —
 * bounds, hit-testing, translate, resize, snap, the renderer — handle nine
 * cases instead of six, and none of the extra three can express anything these
 * cannot. An importer converts on the way in, so this type stays the only
 * thing a wider input grammar would have to change.
 *
 * `c` rather than `command`: a document holds hundreds of these and they are
 * the one field on every one of them.
 */
export type PathSegment =
  | { c: 'M'; x: number; y: number }
  | { c: 'L'; x: number; y: number }
  | { c: 'Q'; x1: number; y1: number; x: number; y: number }
  | { c: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | {
      c: 'A';
      rx: number;
      ry: number;
      /** Degrees the ellipse's own x-axis is turned by. */
      rotation: number;
      large: boolean;
      sweep: boolean;
      x: number;
      y: number;
    }
  | { c: 'Z' };

/**
 * Geometry, per kind. A line is stored as two endpoints rather than a box
 * because a box cannot say which way it runs, and a circle as a centre and a
 * radius because that is what keeps it circular under resize.
 *
 * A rect and an ellipse are both stored as boxes even though `<ellipse>` is
 * written as a centre and two radii: which element a shape *is* and how its
 * attributes are encoded are separate questions, and the renderer converts.
 *
 * A path is its commands and nothing else — an arc, a wedge and a donut
 * segment are all presets that *make* commands, the same way a hexagon is a
 * preset that makes a point list. Nothing afterwards remembers which one it
 * came from.
 */
export type Geometry =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; radius: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'ellipse'; x: number; y: number; w: number; h: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'polyline'; points: Point[] }
  | { kind: 'polygon'; points: Point[] }
  | { kind: 'path'; segments: PathSegment[] };

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
}

export interface DocumentSummary {
  id: string;
  name: string;
  artboard: Artboard;
  updatedAt: number;
}
