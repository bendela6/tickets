import { ARTBOARD_MAX, ARTBOARD_MIN, DEFAULT_INK } from '../doc/constants';
import { emptyDocument, objectId } from '../doc/defaults';
import { isOpenRun } from '../doc/geometry';
import type {
  Artboard,
  Geometry,
  IconDoc,
  IconObject,
  Pair,
  PathSegment,
  Point,
  ShapeKind,
} from '../doc/types';
import {
  applyMatrix,
  IDENTITY,
  multiply,
  parseColour,
  parseLength,
  parseNumbers,
  parsePathData,
  parseSvg,
  parseTransform,
  translation,
  type Matrix,
  type SvgNode,
} from './parse';

/**
 * A parsed file as a document.
 *
 * Two rules decide everything below. **An import always opens a new document**,
 * because the incoming `viewBox` and whatever artboard is open almost never
 * agree and merging would have to silently scale or clip one of them. And
 * **anything that cannot be represented is dropped and named**, because an
 * importer that quietly loses half a file is worse than one that refuses it —
 * hence the report, which is not a log but the second half of the result.
 */
export interface ImportReport {
  objects: number;
  notes: { element: string; reason: string }[];
}

export type ImportOutcome =
  | { ok: true; doc: IconDoc; report: ImportReport }
  | { ok: false; message: string };

/**
 * An import that has happened, named by the file it came from, kept until it
 * has been read.
 *
 * A file that could not be read at all and one that was read with losses are
 * both worth showing and are not the same event, so they are two shapes rather
 * than one with an empty half.
 */
export type ImportSummary =
  | { ok: true; file: string; report: ImportReport }
  | { ok: false; file: string; message: string };

/**
 * The report's notes, deduplicated.
 *
 * A file with forty gradient stops or twenty classed rectangles would otherwise
 * produce forty identical lines, and a report nobody reads is the same as no
 * report at all. Identical (element, reason) pairs collapse; anything that
 * differs in either is a separate entry.
 */
class Notes {
  private readonly seen = new Set<string>();
  readonly list: { element: string; reason: string }[] = [];

  add(element: string, reason: string): void {
    const key = `${element}|${reason}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.list.push({ element, reason });
  }
}

/** Why each of these is dropped, said in the terms of this document model. */
const DROPPED: Readonly<Record<string, string>> = {
  filter: 'a filter is a raster effect, and the model holds vector shapes only',
  mask: 'masking has no equivalent here — every object is painted whole',
  clipPath: 'clipping has no equivalent here — every object is painted whole',
  pattern: 'a pattern is not a colour, and every colour here is a pair of them',
  linearGradient: 'a gradient is not a colour, and every colour here is a pair of them',
  radialGradient: 'a gradient is not a colour, and every colour here is a pair of them',
  use: 'a reference is not resolved, so the shape it points at was not copied',
  symbol: 'a symbol is a template rather than artwork, so nothing in it was drawn',
  text: 'text is not one of the shapes a document may hold',
  image: 'an embedded image is pixels, and the model holds vector shapes only',
  style: 'a CSS block is not applied — only presentation attributes and inline style are read',
  defs: 'definitions are not painted, so nothing inside was imported',
  svg: 'a nested svg brings its own viewport, which one artboard cannot hold',
  foreignObject: 'foreign content is not SVG artwork',
  marker: 'markers are drawn along a stroke, which the model has no term for',
};

const CLASS_NOTE =
  'a class selector is not resolved — only presentation attributes and inline style are read';
const PAIR_NOTE =
  'every imported colour was copied into both the light and the dark half — the dark one is a guess nobody has made';
const CURRENT_COLOUR_NOTE =
  'currentColor has no page to inherit from here, so the default ink was used';

const SHAPES = new Set<string>([
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'path',
] satisfies ShapeKind[]);

/** How far apart two numbers may be and still be the same number. */
const near = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * A quarter turn as a cubic: the control points sit this fraction of the radius
 * along the tangents. The standard constant, and exact to about one part in ten
 * thousand — a hundredth of a unit on a 512 board.
 */
const KAPPA = 0.5522847498307936;

/* ── shapes as commands ─────────────────────────────────────────────────── */

function ellipseSegments(cx: number, cy: number, rx: number, ry: number): PathSegment[] {
  const ax = rx * KAPPA;
  const ay = ry * KAPPA;
  return [
    { c: 'M', x: cx + rx, y: cy },
    { c: 'C', x1: cx + rx, y1: cy + ay, x2: cx + ax, y2: cy + ry, x: cx, y: cy + ry },
    { c: 'C', x1: cx - ax, y1: cy + ry, x2: cx - rx, y2: cy + ay, x: cx - rx, y: cy },
    { c: 'C', x1: cx - rx, y1: cy - ay, x2: cx - ax, y2: cy - ry, x: cx, y: cy - ry },
    { c: 'C', x1: cx + ax, y1: cy - ry, x2: cx + rx, y2: cy - ay, x: cx + rx, y: cy },
    { c: 'Z' },
  ];
}

/** A box with curved corners as commands. `radius` of 0 gives four straight sides. */
function rectSegments(x: number, y: number, w: number, h: number, radius: number): PathSegment[] {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (r === 0) {
    return [
      { c: 'M', x, y },
      { c: 'L', x: x + w, y },
      { c: 'L', x: x + w, y: y + h },
      { c: 'L', x, y: y + h },
      { c: 'Z' },
    ];
  }
  const a = r * KAPPA;
  return [
    { c: 'M', x: x + r, y },
    { c: 'L', x: x + w - r, y },
    { c: 'C', x1: x + w - r + a, y1: y, x2: x + w, y2: y + r - a, x: x + w, y: y + r },
    { c: 'L', x: x + w, y: y + h - r },
    { c: 'C', x1: x + w, y1: y + h - r + a, x2: x + w - r + a, y2: y + h, x: x + w - r, y: y + h },
    { c: 'L', x: x + r, y: y + h },
    { c: 'C', x1: x + r - a, y1: y + h, x2: x, y2: y + h - r + a, x, y: y + h - r },
    { c: 'L', x, y: y + r },
    { c: 'C', x1: x, y1: y + r - a, x2: x + r - a, y2: y, x: x + r, y },
    { c: 'Z' },
  ];
}

/**
 * One `A` command as cubics.
 *
 * An affine map is exact on a cubic and is not exact on an arc — a skewed
 * circle is an ellipse turned on some other axis — so this is what a bake goes
 * through. The endpoint-to-centre conversion is the specification's own; the
 * arc is then cut into pieces of at most a quarter turn, which is where the
 * cubic approximation is at its best.
 */
function arcToCubics(from: Point, arc: Extract<PathSegment, { c: 'A' }>): PathSegment[] {
  const to = { x: arc.x, y: arc.y };
  let rx = Math.abs(arc.rx);
  let ry = Math.abs(arc.ry);
  if (rx === 0 || ry === 0) return [{ c: 'L', x: to.x, y: to.y }];
  if (near(from.x, to.x) && near(from.y, to.y)) return [];

  const phi = (arc.rotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const halfX = (from.x - to.x) / 2;
  const halfY = (from.y - to.y) / 2;
  const x1 = cosPhi * halfX + sinPhi * halfY;
  const y1 = -sinPhi * halfX + cosPhi * halfY;

  const oversize = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (oversize > 1) {
    const grow = Math.sqrt(oversize);
    rx *= grow;
    ry *= grow;
  }

  const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const factor = (arc.large === arc.sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const centreX = (factor * rx * y1) / ry;
  const centreY = (-factor * ry * x1) / rx;
  const cx = cosPhi * centreX - sinPhi * centreY + (from.x + to.x) / 2;
  const cy = sinPhi * centreX + cosPhi * centreY + (from.y + to.y) / 2;

  const start = Math.atan2((y1 - centreY) / ry, (x1 - centreX) / rx);
  const finish = Math.atan2((-y1 - centreY) / ry, (-x1 - centreX) / rx);
  let delta = finish - start;
  if (!arc.sweep && delta > 0) delta -= 2 * Math.PI;
  if (arc.sweep && delta < 0) delta += 2 * Math.PI;

  const pieces = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / pieces;
  const alpha = (4 / 3) * Math.tan(step / 4);
  const at = (angle: number): Point => ({
    x: cx + rx * Math.cos(angle) * cosPhi - ry * Math.sin(angle) * sinPhi,
    y: cy + rx * Math.cos(angle) * sinPhi + ry * Math.sin(angle) * cosPhi,
  });
  const tangent = (angle: number): Point => ({
    x: -rx * Math.sin(angle) * cosPhi - ry * Math.cos(angle) * sinPhi,
    y: -rx * Math.sin(angle) * sinPhi + ry * Math.cos(angle) * cosPhi,
  });

  const out: PathSegment[] = [];
  let angle = start;
  let head = at(angle);
  for (let i = 0; i < pieces; i++) {
    const next = angle + step;
    const tail = at(next);
    const outgoing = tangent(angle);
    const incoming = tangent(next);
    out.push({
      c: 'C',
      x1: head.x + alpha * outgoing.x,
      y1: head.y + alpha * outgoing.y,
      x2: tail.x - alpha * incoming.x,
      y2: tail.y - alpha * incoming.y,
      x: tail.x,
      y: tail.y,
    });
    angle = next;
    head = tail;
  }
  // The last piece ends at the stated point rather than at the sampled one, so
  // the command that follows begins exactly where this one left off.
  const last = out[out.length - 1];
  if (last && last.c === 'C') {
    last.x = to.x;
    last.y = to.y;
  }
  return out;
}

/** The same commands with every arc rewritten as cubics. */
function withoutArcs(segments: readonly PathSegment[]): PathSegment[] {
  const out: PathSegment[] = [];
  let at: Point = { x: 0, y: 0 };
  let opened: Point = at;
  for (const segment of segments) {
    switch (segment.c) {
      case 'A':
        for (const cubic of arcToCubics(at, segment)) out.push(cubic);
        at = { x: segment.x, y: segment.y };
        break;
      case 'M':
        at = { x: segment.x, y: segment.y };
        opened = at;
        out.push(segment);
        break;
      case 'Z':
        at = opened;
        out.push(segment);
        break;
      default:
        at = { x: segment.x, y: segment.y };
        out.push(segment);
    }
  }
  return out;
}

/** Any geometry as commands, arcs already flattened to cubics. */
function segmentsOf(geometry: Geometry): PathSegment[] {
  switch (geometry.kind) {
    case 'rect':
      return rectSegments(geometry.x, geometry.y, geometry.w, geometry.h, geometry.radius);
    case 'circle':
      return ellipseSegments(geometry.cx, geometry.cy, geometry.r, geometry.r);
    case 'ellipse':
      return ellipseSegments(
        geometry.x + geometry.w / 2,
        geometry.y + geometry.h / 2,
        geometry.w / 2,
        geometry.h / 2,
      );
    case 'line':
      return [
        { c: 'M', x: geometry.x1, y: geometry.y1 },
        { c: 'L', x: geometry.x2, y: geometry.y2 },
      ];
    case 'polyline':
    case 'polygon': {
      const [first, ...rest] = geometry.points;
      if (!first) return [];
      const out: PathSegment[] = [{ c: 'M', x: first.x, y: first.y }];
      for (const point of rest) out.push({ c: 'L', x: point.x, y: point.y });
      if (geometry.kind === 'polygon') out.push({ c: 'Z' });
      return out;
    }
    case 'path':
      return withoutArcs(geometry.segments);
  }
}

/**
 * The same commands, left open.
 *
 * A closed shape is a region and is drawn by its fill; there is no unfilled
 * rectangle in this model. An outline-only shape therefore arrives as the run
 * that traces it — the closing edge spelled out as a line, so the stroke still
 * draws all four sides of a box.
 */
function openRunOf(segments: readonly PathSegment[]): PathSegment[] {
  const out: PathSegment[] = [];
  let at: Point = { x: 0, y: 0 };
  let opened: Point = at;
  for (const segment of segments) {
    if (segment.c === 'Z') {
      if (!near(at.x, opened.x) || !near(at.y, opened.y)) {
        out.push({ c: 'L', x: opened.x, y: opened.y });
      }
      at = opened;
      continue;
    }
    if (segment.c === 'M') {
      at = { x: segment.x, y: segment.y };
      opened = at;
    } else {
      at = { x: segment.x, y: segment.y };
    }
    out.push(segment);
  }
  return out;
}

/* ── transforms ─────────────────────────────────────────────────────────── */

/**
 * What a matrix is, as far as the model is concerned.
 *
 * `axis` is a scale and a move with no turn in it, which every kind survives.
 * `similar` is a turn and an even scale, which the object's own `rotation`
 * can carry. Anything else — a skew, or a turn with an uneven scale — is a
 * shape this model has no term for, and has to be baked into coordinates.
 */
type Placement =
  | { kind: 'axis'; sx: number; sy: number }
  | { kind: 'similar'; scale: number; degrees: number }
  | { kind: 'general' };

function placementOf(m: Matrix): Placement {
  if (near(m.b, 0) && near(m.c, 0)) return { kind: 'axis', sx: m.a, sy: m.d };
  if (near(m.a, m.d) && near(m.b, -m.c)) {
    return {
      kind: 'similar',
      scale: Math.hypot(m.a, m.b),
      degrees: (Math.atan2(m.b, m.a) * 180) / Math.PI,
    };
  }
  return { kind: 'general' };
}

/** How much a matrix scales a stroke: the geometric mean of its two axes. */
const strokeScaleOf = (m: Matrix): number => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A box through an axis-aligned matrix, normalised so a flip stays a box. */
function movedBox(box: Box, m: Matrix): Box {
  const a = applyMatrix(m, { x: box.x, y: box.y });
  const b = applyMatrix(m, { x: box.x + box.w, y: box.y + box.h });
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

const movedPoints = (points: readonly Point[], m: Matrix): Point[] =>
  points.map((point) => applyMatrix(m, point));

/**
 * Commands through a matrix.
 *
 * `arcs` says what to do with an `A`: `turn` scales its radii and adds to the
 * angle its own axis sits at, which is exact under an even scale and a rotation
 * and wrong under anything else; `cubics` gives up the arc for curves an affine
 * map cannot disturb.
 */
function movedSegments(
  segments: readonly PathSegment[],
  m: Matrix,
  arcs: { mode: 'turn'; scale: number; degrees: number } | { mode: 'cubics' },
): PathSegment[] {
  const source = arcs.mode === 'cubics' ? withoutArcs(segments) : segments;
  return source.map((segment): PathSegment => {
    switch (segment.c) {
      case 'M':
      case 'L':
        return { ...segment, ...applyMatrix(m, segment) };
      case 'Q': {
        const control = applyMatrix(m, { x: segment.x1, y: segment.y1 });
        return { ...segment, x1: control.x, y1: control.y, ...applyMatrix(m, segment) };
      }
      case 'C': {
        const first = applyMatrix(m, { x: segment.x1, y: segment.y1 });
        const second = applyMatrix(m, { x: segment.x2, y: segment.y2 });
        return {
          ...segment,
          x1: first.x,
          y1: first.y,
          x2: second.x,
          y2: second.y,
          ...applyMatrix(m, segment),
        };
      }
      case 'A': {
        const scale = arcs.mode === 'turn' ? arcs.scale : 1;
        const degrees = arcs.mode === 'turn' ? arcs.degrees : 0;
        return {
          ...segment,
          rx: segment.rx * scale,
          ry: segment.ry * scale,
          rotation: segment.rotation + degrees,
          ...applyMatrix(m, segment),
        };
      }
      case 'Z':
        return segment;
    }
  });
}

interface Placed {
  geometry: Geometry;
  /** Degrees about the shape's own centre — the model's one transform. */
  rotation: number;
  /** What was given up, if anything. */
  note: string | null;
}

const BAKED_KIND_NOTE =
  'an uneven scale or a skew cannot be stated on this kind, so it became a path with the transform baked into its coordinates';
const BAKED_POINTS_NOTE =
  'an uneven scale or a skew was baked into its coordinates rather than approximated';
const CIRCLE_TO_ELLIPSE_NOTE = 'an uneven scale turned this circle into an ellipse';
const CORNER_NOTE =
  'an uneven scale would make its corner curves elliptical, which one corner radius cannot say, so it became a path';

/** The geometry as the model can state it exactly, or null when it cannot. */
function exactly(geometry: Geometry, m: Matrix, spot: Placement): Placed | null {
  const kept = (next: Geometry, note: string | null = null): Placed => ({
    geometry: next,
    rotation: 0,
    note,
  });

  // Point lists and curves take any affine map exactly; only an arc does not.
  const asPoints = (note: string | null): Placed | null => {
    switch (geometry.kind) {
      case 'line': {
        const a = applyMatrix(m, { x: geometry.x1, y: geometry.y1 });
        const b = applyMatrix(m, { x: geometry.x2, y: geometry.y2 });
        return kept({ kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y }, note);
      }
      case 'polyline':
      case 'polygon':
        return kept({ ...geometry, points: movedPoints(geometry.points, m) }, note);
      default:
        return null;
    }
  };

  if (spot.kind === 'axis') {
    const sx = Math.abs(spot.sx);
    const sy = Math.abs(spot.sy);
    const even = near(sx, sy);
    switch (geometry.kind) {
      case 'rect': {
        if (geometry.radius > 0 && !even) return null;
        const box = movedBox(geometry, m);
        return kept({ kind: 'rect', ...box, radius: geometry.radius * sx });
      }
      case 'circle': {
        const centre = applyMatrix(m, { x: geometry.cx, y: geometry.cy });
        if (even) return kept({ kind: 'circle', cx: centre.x, cy: centre.y, r: geometry.r * sx });
        // A circle under an uneven scale is an ellipse — a different element,
        // which this model has, so it changes kind rather than being baked.
        return kept(
          {
            kind: 'ellipse',
            x: centre.x - geometry.r * sx,
            y: centre.y - geometry.r * sy,
            w: geometry.r * 2 * sx,
            h: geometry.r * 2 * sy,
          },
          CIRCLE_TO_ELLIPSE_NOTE,
        );
      }
      case 'ellipse':
        return kept({ kind: 'ellipse', ...movedBox(geometry, m) });
      case 'path': {
        // Arcs survive an even, un-mirrored scale and nothing else: a negative
        // scale turns the sweep inside out.
        const turns = even && spot.sx > 0 && spot.sy > 0;
        const hasArc = geometry.segments.some((segment) => segment.c === 'A');
        if (!turns && hasArc) {
          return kept(
            { kind: 'path', segments: movedSegments(geometry.segments, m, { mode: 'cubics' }) },
            BAKED_KIND_NOTE,
          );
        }
        return kept({
          kind: 'path',
          segments: movedSegments(geometry.segments, m, { mode: 'turn', scale: sx, degrees: 0 }),
        });
      }
      default:
        return asPoints(null);
    }
  }

  if (spot.kind === 'similar') {
    const { scale, degrees } = spot;
    switch (geometry.kind) {
      case 'rect':
      case 'ellipse': {
        const centre = applyMatrix(m, {
          x: geometry.x + geometry.w / 2,
          y: geometry.y + geometry.h / 2,
        });
        const w = geometry.w * scale;
        const h = geometry.h * scale;
        const box = { x: centre.x - w / 2, y: centre.y - h / 2, w, h };
        // The turn goes on the object rather than into the geometry: the
        // renderer turns a shape about the centre of its own box, which is
        // exactly where the matrix has just put this one.
        const next: Geometry =
          geometry.kind === 'rect'
            ? { kind: 'rect', ...box, radius: geometry.radius * scale }
            : { kind: 'ellipse', ...box };
        return { geometry: next, rotation: degrees, note: null };
      }
      case 'circle': {
        const centre = applyMatrix(m, { x: geometry.cx, y: geometry.cy });
        return kept({ kind: 'circle', cx: centre.x, cy: centre.y, r: geometry.r * scale });
      }
      case 'path':
        return kept({
          kind: 'path',
          segments: movedSegments(geometry.segments, m, { mode: 'turn', scale, degrees }),
        });
      default:
        return asPoints(null);
    }
  }

  if (geometry.kind === 'path') {
    return kept(
      { kind: 'path', segments: movedSegments(geometry.segments, m, { mode: 'cubics' }) },
      BAKED_POINTS_NOTE,
    );
  }
  return asPoints(BAKED_POINTS_NOTE);
}

/**
 * The geometry with the transform applied.
 *
 * Whatever the model can say outright it says — a moved box is a box, a turned
 * rectangle is a rectangle with a rotation. What it cannot say is baked into a
 * path's coordinates rather than approximated, and reported either way: a skew
 * quietly nudged to the nearest similarity is exactly the silent loss this
 * importer exists not to commit.
 */
function place(geometry: Geometry, m: Matrix): Placed {
  const spot = placementOf(m);
  const exact = exactly(geometry, m, spot);
  if (exact) return exact;
  return {
    geometry: { kind: 'path', segments: movedSegments(segmentsOf(geometry), m, { mode: 'cubics' }) },
    rotation: 0,
    // The only shape that reaches here with no turn in its matrix is a box
    // whose corners are curved, and its corners are the reason.
    note: spot.kind === 'axis' ? CORNER_NOTE : BAKED_KIND_NOTE,
  };
}

/* ── paint ──────────────────────────────────────────────────────────────── */

const pairOf = (hex: string): Pair => ({ light: hex, dark: hex });

type Ink = { kind: 'paint'; pair: Pair } | { kind: 'none' } | { kind: 'absent' };

function inkOf(value: string | undefined, tag: string, notes: Notes): Ink {
  if (value === undefined || value.trim() === '') return { kind: 'absent' };
  if (value.trim().toLowerCase() === 'currentcolor') {
    notes.add(tag, CURRENT_COLOUR_NOTE);
    return { kind: 'paint', pair: { ...DEFAULT_INK } };
  }
  const colour = parseColour(value);
  if (colour.kind === 'none') return { kind: 'none' };
  if (colour.kind === 'colour') return { kind: 'paint', pair: pairOf(colour.hex) };
  notes.add(
    tag,
    `${colour.text} is not a colour this reads — a gradient, a pattern or an unknown name — so the default ink was used`,
  );
  return { kind: 'paint', pair: { ...DEFAULT_INK } };
}

/** An alpha attribute — a number, or a percentage of one. */
function parseAlpha(value: string | undefined): number | null {
  if (value === undefined) return null;
  const text = value.trim();
  const number = text.endsWith('%') ? Number(text.slice(0, -1)) / 100 : Number(text);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(1, number));
}

/* ── the walk ───────────────────────────────────────────────────────────── */

/** What a group hands down: its transform, and the paint its children inherit. */
interface Context {
  matrix: Matrix;
  fill: string | undefined;
  stroke: string | undefined;
  strokeWidth: string | undefined;
  fillOpacity: string | undefined;
  strokeOpacity: string | undefined;
  /** Group opacity, already multiplied out. */
  opacity: number;
}

function geometryOf(node: SvgNode, notes: Notes): Geometry | null {
  const attrs = node.attrs;
  const number = (name: string): number => parseLength(attrs[name]) ?? 0;

  switch (node.tag) {
    case 'rect': {
      const w = number('width');
      const h = number('height');
      if (w <= 0 || h <= 0) {
        notes.add('rect', 'it has no width or no height, so it would paint nothing');
        return null;
      }
      const rx = parseLength(attrs['rx']);
      const ry = parseLength(attrs['ry']);
      if (rx !== null && ry !== null && !near(rx, ry)) {
        notes.add(
          'rect',
          `its corners are ${rx} by ${ry}; the model holds one corner radius, so ${rx} was kept`,
        );
      }
      return {
        kind: 'rect',
        x: number('x'),
        y: number('y'),
        w,
        h,
        radius: Math.max(0, rx ?? ry ?? 0),
      };
    }
    case 'circle': {
      const r = number('r');
      if (r <= 0) {
        notes.add('circle', 'its radius is zero, so it would paint nothing');
        return null;
      }
      return { kind: 'circle', cx: number('cx'), cy: number('cy'), r };
    }
    case 'ellipse': {
      const rx = number('rx');
      const ry = number('ry');
      if (rx <= 0 || ry <= 0) {
        notes.add('ellipse', 'one of its radii is zero, so it would paint nothing');
        return null;
      }
      return { kind: 'ellipse', x: number('cx') - rx, y: number('cy') - ry, w: rx * 2, h: ry * 2 };
    }
    case 'line':
      return {
        kind: 'line',
        x1: number('x1'),
        y1: number('y1'),
        x2: number('x2'),
        y2: number('y2'),
      };
    case 'polyline':
    case 'polygon': {
      const numbers = parseNumbers(attrs['points'] ?? '');
      const points: Point[] = [];
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        const x = numbers[i];
        const y = numbers[i + 1];
        if (x !== undefined && y !== undefined) points.push({ x, y });
      }
      if (numbers.length % 2 === 1) {
        notes.add(node.tag, 'its point list ends on a lone number, which was dropped');
      }
      if (points.length < 2) {
        notes.add(node.tag, 'it has fewer than two points, so it would paint nothing');
        return null;
      }
      return node.tag === 'polygon' ? { kind: 'polygon', points } : { kind: 'polyline', points };
    }
    case 'path': {
      const { segments, error } = parsePathData(attrs['d'] ?? '');
      if (error) notes.add('path', `${error} — the commands before it were kept`);
      if (segments.length === 0) {
        notes.add('path', 'its d attribute holds no commands');
        return null;
      }
      return { kind: 'path', segments };
    }
    default:
      return null;
  }
}

/**
 * One element as an object, or null when it would paint nothing.
 *
 * The order matters: the geometry is placed first, because whether a shape is a
 * region or a run — which decides whether its fill or its stroke is the mark
 * you see — is a question only the placed geometry can answer.
 */
function objectOf(
  node: SvgNode,
  context: Context,
  sequence: number,
  notes: Notes,
): IconObject | null {
  const geometry = geometryOf(node, notes);
  if (!geometry) return null;

  const placed = place(geometry, context.matrix);
  if (placed.note) notes.add(node.tag, placed.note);

  const attrs = node.attrs;
  const fill = inkOf(attrs['fill'] ?? context.fill, node.tag, notes);
  const stroke = inkOf(attrs['stroke'] ?? context.stroke, node.tag, notes);
  const width = parseLength(attrs['stroke-width'] ?? context.strokeWidth) ?? 1;
  const strokeWidth = Math.max(0, width * strokeScaleOf(context.matrix));

  let shape = placed.geometry;
  let run = isOpenRun(shape);
  let paint: Pair;
  let outline: Pair;
  let outlineWidth: number;

  if (!run && fill.kind === 'none') {
    if (stroke.kind !== 'paint') {
      notes.add(node.tag, 'its fill and its stroke are both none, so it would paint nothing');
      return null;
    }
    // An unfilled outline is a run in this model, so it becomes the path that
    // traces the shape rather than the shape itself — which draws the same
    // picture, where a filled rectangle would not.
    shape = { kind: 'path', segments: openRunOf(segmentsOf(shape)) };
    run = true;
    notes.add(
      node.tag,
      'it is unfilled, and only a run may be unfilled here, so it became an open path tracing its outline',
    );
  }

  if (run) {
    // A run is drawn by its stroke and by nothing else, so the colour it is
    // drawn in is the stroke's — and where a file gives it only a fill, that
    // colour is what it meant, so that is what the stroke becomes.
    if (stroke.kind === 'paint') {
      paint = stroke.pair;
    } else if (shape.kind === 'line') {
      notes.add(node.tag, 'a line with no stroke paints nothing — a fill has no area to cover');
      return null;
    } else if (fill.kind === 'paint') {
      notes.add(node.tag, 'it has no stroke, and a run is drawn by its stroke, so its fill colour was used');
      paint = fill.pair;
    } else if (fill.kind === 'absent') {
      notes.add(node.tag, "it states no paint at all, so SVG's default black became its stroke");
      paint = pairOf('#000000');
    } else {
      notes.add(node.tag, 'its fill and its stroke are both none, so it would paint nothing');
      return null;
    }
    outline = paint;
    outlineWidth = strokeWidth;
  } else {
    // SVG's own default: an element with no fill stated is filled black.
    paint = fill.kind === 'paint' ? fill.pair : pairOf('#000000');
    outline = stroke.kind === 'paint' ? stroke.pair : paint;
    outlineWidth = stroke.kind === 'paint' ? strokeWidth : 0;
  }

  const fillAlpha = parseAlpha(attrs['fill-opacity'] ?? context.fillOpacity) ?? 1;
  const strokeAlpha = parseAlpha(attrs['stroke-opacity'] ?? context.strokeOpacity) ?? 1;
  if (!run && outlineWidth > 0 && !near(fillAlpha, strokeAlpha)) {
    notes.add(
      node.tag,
      'its fill and its stroke are differently transparent; the model has one opacity, so the fill governs',
    );
  }
  const alpha =
    context.opacity * (parseAlpha(attrs['opacity']) ?? 1) * (run ? strokeAlpha : fillAlpha);

  const kind = shape.kind;
  const named = attrs['id']?.trim();
  return {
    id: objectId(kind, sequence),
    name: named && named !== '' ? named : `${kind} ${sequence}`,
    geometry: shape,
    fill: paint,
    stroke: outline,
    strokeWidth: outlineWidth,
    opacity: Math.max(0, Math.min(100, Math.round(alpha * 1000) / 10)),
    rotation: placed.rotation,
    hidden: false,
    locked: false,
    motion: { takesPart: true, role: 'spins', pace: 1 },
  };
}

function contextFor(node: SvgNode, parent: Context): Context {
  const attrs = node.attrs;
  const own = attrs['transform'];
  const matrix = own === undefined ? parent.matrix : multiply(parent.matrix, parseTransform(own).matrix);
  return {
    matrix,
    fill: attrs['fill'] ?? parent.fill,
    stroke: attrs['stroke'] ?? parent.stroke,
    strokeWidth: attrs['stroke-width'] ?? parent.strokeWidth,
    fillOpacity: attrs['fill-opacity'] ?? parent.fillOpacity,
    strokeOpacity: attrs['stroke-opacity'] ?? parent.strokeOpacity,
    // Group opacity multiplies out. It is exact while a group's children do not
    // overlap and near enough when they do — the alternative is a flattened
    // group that is visibly darker than the file it came from.
    opacity: parent.opacity * (parseAlpha(attrs['opacity']) ?? 1),
  };
}

/** Elements that carry no artwork and lose nothing by being skipped. */
const SILENT = new Set(['title', 'desc', 'metadata']);

function walk(
  node: SvgNode,
  context: Context,
  out: IconObject[],
  notes: Notes,
  count: { taken: number },
): void {
  for (const child of node.children) {
    const tag = child.tag;
    if (SILENT.has(tag)) continue;
    if (child.attrs['class'] !== undefined) notes.add(tag, CLASS_NOTE);

    if (tag === 'g') {
      notes.add(
        'g',
        'the model has no groups, so its transform and paint were pushed onto its children and the group itself dropped',
      );
      walk(child, contextFor(child, context), out, notes, count);
      continue;
    }

    if (SHAPES.has(tag)) {
      // Its own transform composes here rather than through `contextFor`,
      // which is for groups only: that folds an element's opacity into the
      // inherited one, and a shape's own opacity is applied by `objectOf` —
      // going through both would square it.
      const transform = child.attrs['transform'];
      const parsed = transform === undefined ? null : parseTransform(transform);
      if (parsed?.error) notes.add(tag, parsed.error);
      const matrix = parsed ? multiply(context.matrix, parsed.matrix) : context.matrix;
      count.taken += 1;
      const object = objectOf(child, { ...context, matrix }, count.taken, notes);
      if (object) out.push(object);
      continue;
    }

    notes.add(tag, DROPPED[tag] ?? 'this element is not one the document model has a kind for');
  }
}

/* ── the artboard ───────────────────────────────────────────────────────── */

const clampSide = (value: number): number =>
  Math.min(ARTBOARD_MAX, Math.max(ARTBOARD_MIN, value));

const DEFAULT_ARTBOARD: Artboard = { width: 512, height: 512 };

/**
 * The artboard, and where the file's own origin sits.
 *
 * A `viewBox` may start anywhere; the model's artboard always starts at 0,0, so
 * a non-zero origin becomes the first translate every shape goes through. That
 * is exact, so nothing is reported for it.
 */
function artboardOf(root: SvgNode, notes: Notes): { artboard: Artboard; origin: Point } {
  const viewBox = root.attrs['viewBox'];
  if (viewBox !== undefined) {
    const numbers = parseNumbers(viewBox);
    const [minX, minY, width, height] = numbers;
    if (
      numbers.length >= 4 &&
      minX !== undefined &&
      minY !== undefined &&
      width !== undefined &&
      height !== undefined &&
      width > 0 &&
      height > 0
    ) {
      return {
        artboard: { width: clampSide(width), height: clampSide(height) },
        origin: { x: minX, y: minY },
      };
    }
    notes.add('svg', `its viewBox "${viewBox}" is not four numbers with a positive size`);
  }

  const width = parseLength(root.attrs['width']);
  const height = parseLength(root.attrs['height']);
  if (width !== null && height !== null && width > 0 && height > 0) {
    if (viewBox === undefined) {
      notes.add('svg', 'it has no viewBox, so the artboard was taken from its width and height');
    }
    return {
      artboard: { width: clampSide(width), height: clampSide(height) },
      origin: { x: 0, y: 0 },
    };
  }

  notes.add(
    'svg',
    `it states neither a viewBox nor a usable width and height, so the ${DEFAULT_ARTBOARD.width} × ${DEFAULT_ARTBOARD.height} default was used`,
  );
  return { artboard: { ...DEFAULT_ARTBOARD }, origin: { x: 0, y: 0 } };
}

/* ── the import ─────────────────────────────────────────────────────────── */

/**
 * An SVG file as a new document, with a report of what did not survive.
 *
 * The object list comes back reversed: SVG paints in source order, so the last
 * element in the file is the frontmost, and this model's list reads front to
 * back the way a layers panel does.
 */
export function importSvg(text: string, name: string): ImportOutcome {
  const parsed = parseSvg(text);
  if (!parsed.ok) return parsed;

  const notes = new Notes();
  const { artboard, origin } = artboardOf(parsed.root, notes);
  const root = parsed.root;
  if (root.attrs['class'] !== undefined) notes.add('svg', CLASS_NOTE);

  const own = root.attrs['transform'];
  const matrix = multiply(
    translation(-origin.x, -origin.y),
    own === undefined ? IDENTITY : parseTransform(own).matrix,
  );

  const objects: IconObject[] = [];
  walk(
    root,
    {
      matrix,
      fill: root.attrs['fill'],
      stroke: root.attrs['stroke'],
      strokeWidth: root.attrs['stroke-width'],
      fillOpacity: root.attrs['fill-opacity'],
      strokeOpacity: root.attrs['stroke-opacity'],
      opacity: parseAlpha(root.attrs['opacity']) ?? 1,
    },
    objects,
    notes,
    { taken: 0 },
  );

  if (objects.length > 0) notes.add('svg', PAIR_NOTE);

  const doc: IconDoc = { ...emptyDocument(name, artboard), objects: objects.reverse() };
  return { ok: true, doc, report: { objects: objects.length, notes: notes.list } };
}
