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
 *    way a layers list reads. The renderer paints in reverse. That holds at
 *    every level of the tree, not only at the top.
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

/**
 * How a surface behaves under light — never what colour it is.
 *
 * A material is a treatment layered *over* the paint a shape already states.
 * The fill, the stroke, the stroke width and the opacity all keep the meaning
 * they have always had, and every pass the renderer adds takes its colour from
 * that same pair. That is the whole reason it is one word here rather than a
 * block of paint of its own: the contrast readout still has a real colour to
 * measure, the boolean engine still sees a plain outline, and the importer
 * still has nothing new to fail to understand.
 *
 * Six, and the two that were left out say what the list is. An emboss and a
 * long shadow both describe a *scene* — where the light is, where the floor is
 * — and an icon has no scene: it is 16 pixels on somebody else's wallpaper.
 * These six describe the surface itself, which is a statement that survives
 * being shrunk.
 */
export type Material = 'glass' | 'glossy' | 'metal' | 'matte' | 'paper' | 'glow';

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
  /**
   * The treatment layered over this shape's paint, if it has one.
   *
   * Optional and absent rather than a required `'none'`, and that is what makes
   * every document saved before materials existed still a valid one: no field
   * is missing from it, because absence *is* the default. There is nothing for
   * a migration to fill in and nothing for it to walk.
   *
   * **A shape only — a group has none, and cannot be given one.** A group has
   * no paint of its own for a treatment to sit on top of, by the same rule that
   * keeps it from having a fill. A material on a group would have to mean one
   * of two different things — one surface spanning the children, or the same
   * surface applied to each of them separately — and picking either would make
   * a group's appearance a second place a shape's own could be decided.
   */
  material?: Material;
}

/**
 * Where a group sits in the list that holds it: a move, a turn and a scale.
 *
 * **One `scale`, not two**, and that single number is the whole of the decision
 * about what a group resize may do. A group is exported as `<g transform>` and
 * its children keep the coordinates they were written with, so an uneven scale
 * would reach every one of them at once: a `<circle>` inside it would come out
 * an ellipse — a different element, which this model states separately and
 * which a group has no business changing its children into — and a child that
 * carries a turn of its own would come out skewed, which is a shape nothing in
 * this model can say. Making the second number unwritable settles that once,
 * here, instead of in every place a handle could be dragged.
 *
 * The turn and the scale are both about the group's own centre, which is where
 * a handle drag means them. A uniform scale commutes with a rotation, so there
 * is no order between the two to get wrong — the reason the pair is stated as
 * two plain numbers rather than as a matrix.
 */
export interface GroupTransform {
  /** Stated in the units the group's siblings are stated in, not in its own. */
  x: number;
  y: number;
  /** Degrees, about the group's own centre. */
  rotation: number;
  /** Uniform, about the group's own centre. 1 is untouched. */
  scale: number;
}

/**
 * A group: children, and a place to put them. No geometry of its own — a group
 * is where its children are, which is why its box is asked of them.
 *
 * A group has no fill, no stroke and no stroke width either, and that is not an
 * omission. SVG lets a `<g>` state paint for its children to inherit; this
 * model has no inheritance anywhere — every object states both halves of its
 * own pair outright — so a paint on a group would be a second, invisible place
 * a colour could come from.
 */
export interface IconGroup {
  id: string;
  name: string;
  transform: GroupTransform;
  /** 0–100, applied to the group as one thing. */
  opacity: number;
  hidden: boolean;
  locked: boolean;
  /** Front-to-back, like the document's own list. `children[0]` is frontmost. */
  children: IconNode[];
}

/**
 * What a list of objects may hold.
 *
 * A group is a **sibling** of `IconObject` rather than a member of it, and the
 * reason is that almost everything `IconObject` promises is meaningless for a
 * group. `geometry`, `fill`, `stroke` and `strokeWidth` are the four fields the
 * bulk of this app reads, and a group answers none of them — so folding it into
 * `IconObject` would make every one of those reads a question ("is this the
 * kind that has geometry?") in code that has no business asking. As a separate
 * type, `bounds`, `fitToBox`, `contains`, `vertexPoints` and the properties
 * rail keep the signature they always had, and it stays *true*: they are
 * statements about a shape.
 *
 * What that buys is exactly the enforcement wanted. `IconDoc.objects` is
 * `IconNode[]`, so every traversal that used to reach for `.geometry` stops
 * compiling until it says what a group does — there is no field a group happens
 * to share that would let one slip through. Narrowing is `isGroup`, which tests
 * for `children`: a structural discriminant rather than a tag, because a
 * document saved before groups existed is a flat list of shapes and must remain
 * a valid tree without being rewritten.
 */
export type IconNode = IconObject | IconGroup;

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
  /** Front-to-back. `objects[0]` is frontmost. A tree, one level deep or many. */
  objects: IconNode[];
}

export interface DocumentSummary {
  id: string;
  name: string;
  artboard: Artboard;
  updatedAt: number;
}
