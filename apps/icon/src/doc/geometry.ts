import type { Geometry, IconObject, PathSegment, Point } from './types';

export type { Point };

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Whether the shape is a run rather than a region — a thing with length and no
 * area. Those are drawn by their stroke and hit by proximity to it; a fill
 * would paint an area they do not enclose, and an outline would be a second
 * copy of the only mark they have.
 *
 * Stated against the whole geometry rather than the kind alone, because a path
 * answers it for itself: one that closes encloses something, one that does not
 * is a run, and both are the same element. That is what lets one preset make
 * both a spinner and a wedge.
 */
export const isOpenRun = (geometry: Geometry): boolean =>
  geometry.kind === 'path'
    ? !geometry.segments.some((segment) => segment.c === 'Z')
    : geometry.kind === 'line' || geometry.kind === 'polyline';

/** The tightest box round a set of points. */
export function pointsBox(points: readonly Point[]): Box {
  const first = points[0];
  // An empty run has no position to report, and Math.min of nothing is
  // Infinity — which would travel into a style attribute and blank the canvas.
  if (!first) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = first.x;
  let maxX = first.x;
  let minY = first.y;
  let maxY = first.y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** A box grown by `pad` on every side. */
const inflate = (box: Box, pad: number): Box => ({
  x: box.x - pad,
  y: box.y - pad,
  w: box.w + pad * 2,
  h: box.h + pad * 2,
});

/**
 * How far a flattened path may sit from the curve it stands in for, in
 * document units.
 *
 * Half the finest snap step the document offers, so the approximation is never
 * as much as one grid position out. It is also cheap at icon sizes: a quarter
 * circle of radius 120 takes thirteen segments to hold, and the number grows
 * with the square root of the radius rather than with it.
 */
export const FLATTEN_TOLERANCE = 0.25;

/**
 * The finest tolerance that will be honoured. Zero is unsatisfiable — a curve
 * is never exactly a line — and asking for it would subdivide until the stack
 * gave out.
 */
const FLATTEN_FINEST = 0.001;

/**
 * How many times a curve may be halved. 2¹⁰ segments is far past the point of
 * visibility at any artboard size; the bound is there so a pathological curve
 * cannot spin rather than because anything reaches it.
 */
const FLATTEN_DEPTH = 10;

/** The same ceiling stated for an arc, which is sampled rather than halved. */
const FLATTEN_STEPS = 1 << FLATTEN_DEPTH;

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** A point `t` of the way from `a` to `b`. */
const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

/**
 * The two controls of the cubic a quadratic already is.
 *
 * Degree elevation, not approximation: the curve and its parameterisation are
 * identical, which is why the flattener, the nearest-point search and the
 * splitter can all speak one language and still hand a `Q` back a `Q`.
 */
function quadraticControls(from: Point, segment: Extract<PathSegment, { c: 'Q' }>): [Point, Point] {
  return [
    {
      x: from.x + (2 / 3) * (segment.x1 - from.x),
      y: from.y + (2 / 3) * (segment.y1 - from.y),
    },
    {
      x: segment.x + (2 / 3) * (segment.x1 - segment.x),
      y: segment.y + (2 / 3) * (segment.y1 - segment.y),
    },
  ];
}

/**
 * The cubic's points appended to `out`, excluding the one it starts from —
 * which the run it is being added to already holds.
 *
 * Halved until flat rather than sampled at a fixed count, so a gentle curve
 * costs two segments and a tight one costs what it needs. Flatness is measured
 * against the control points rather than the curve: the curve never strays
 * further from the chord than they do, so the result is inside the tolerance
 * rather than merely near it.
 */
function flattenCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  tolerance: number,
  depth: number,
  out: Point[],
): void {
  const flat =
    distanceToSegment(p1, p0, p3) <= tolerance && distanceToSegment(p2, p0, p3) <= tolerance;
  if (flat || depth >= FLATTEN_DEPTH) {
    out.push(p3);
    return;
  }
  // de Casteljau at the halfway point: the two halves are exact cubics, so
  // nothing is approximated until the recursion stops.
  const a = midpoint(p0, p1);
  const b = midpoint(p1, p2);
  const c = midpoint(p2, p3);
  const d = midpoint(a, b);
  const e = midpoint(b, c);
  const mid = midpoint(d, e);
  flattenCubic(p0, a, d, mid, tolerance, depth + 1, out);
  flattenCubic(mid, e, c, p3, tolerance, depth + 1, out);
}

/**
 * The arc's points, excluding the one it starts from.
 *
 * SVG states an arc by where it ends and which of the four candidate arcs to
 * take; sampling one needs its centre and its two angles, so this is the
 * conversion the SVG specification sets out, followed by even sampling.
 */
function flattenArc(from: Point, segment: Extract<PathSegment, { c: 'A' }>, tolerance: number): Point[] {
  const to = { x: segment.x, y: segment.y };
  let rx = Math.abs(segment.rx);
  let ry = Math.abs(segment.ry);
  // The specification's own degenerate cases: an arc with no radius is a
  // straight line, and one that ends where it started is nothing at all.
  if (rx === 0 || ry === 0) return [to];
  if (from.x === to.x && from.y === to.y) return [];

  const phi = (segment.rotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const halfX = (from.x - to.x) / 2;
  const halfY = (from.y - to.y) / 2;
  const x1 = cosPhi * halfX + sinPhi * halfY;
  const y1 = -sinPhi * halfX + cosPhi * halfY;

  // Radii too small to reach both ends are grown until they just do. This is
  // the specification's repair, and it is what keeps a shrunk arc drawable
  // instead of silently blank.
  const oversize = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (oversize > 1) {
    const grow = Math.sqrt(oversize);
    rx *= grow;
    ry *= grow;
  }

  const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const factor =
    (segment.large === segment.sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const centreX = (factor * rx * y1) / ry;
  const centreY = (-factor * ry * x1) / rx;
  const cx = cosPhi * centreX - sinPhi * centreY + (from.x + to.x) / 2;
  const cy = sinPhi * centreX + cosPhi * centreY + (from.y + to.y) / 2;

  const start = Math.atan2((y1 - centreY) / ry, (x1 - centreX) / rx);
  const finish = Math.atan2((-y1 - centreY) / ry, (-x1 - centreX) / rx);
  let delta = finish - start;
  if (!segment.sweep && delta > 0) delta -= 2 * Math.PI;
  if (segment.sweep && delta < 0) delta += 2 * Math.PI;

  // A chord across `step` radians of a circle of radius R bulges R(1−cos(step/2))
  // away from it, so this is the widest step whose bulge stays inside the
  // tolerance. The larger radius governs, being the worse of the two.
  const reach = Math.max(rx, ry);
  const step = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tolerance / reach)));
  const steps = Math.max(1, Math.min(FLATTEN_STEPS, Math.ceil(Math.abs(delta) / step)));

  const points: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const angle = start + (delta * i) / steps;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    points.push({
      x: cx + rx * cos * cosPhi - ry * sin * sinPhi,
      y: cy + rx * cos * sinPhi + ry * sin * cosPhi,
    });
  }
  // The last sample is the stated endpoint to within float noise; use the
  // stored one, so the run ends exactly where the next command begins.
  points[points.length - 1] = to;
  return points;
}

/**
 * The path as a run of straight segments, within `tolerance` document units of
 * the true curve.
 *
 * This is the one approximation in the file, and everything else about a path
 * is derived from it: its box, its hit test and its Lottie export all read
 * these points rather than solving each command's own maths, which would be
 * six answers per question instead of one.
 *
 * One run per subpath — an `M` starts a new one — so a shape with a hole comes
 * back as two, which is what even-odd containment needs to tell a hole from a
 * body. Every point is *on* the curve, so a box drawn round them can fall
 * short of the true extreme by at most the tolerance and never overstates it.
 */
export function flattenPath(
  segments: readonly PathSegment[],
  tolerance: number = FLATTEN_TOLERANCE,
): Point[][] {
  const within = Math.max(tolerance, FLATTEN_FINEST);
  const runs: Point[][] = [];
  let run: Point[] | null = null;
  let at: Point = { x: 0, y: 0 };
  let opened: Point = at;

  // The run in progress, started where the pen is if a command arrives before
  // any `M`. That path is malformed, but dropping the shape teaches nobody
  // anything and losing it is worse than drawing it.
  const active = (): Point[] => {
    if (run) return run;
    const started = [at];
    run = started;
    runs.push(started);
    return started;
  };

  for (const segment of segments) {
    switch (segment.c) {
      case 'M': {
        at = { x: segment.x, y: segment.y };
        opened = at;
        const started = [at];
        run = started;
        runs.push(started);
        break;
      }
      case 'L':
        at = { x: segment.x, y: segment.y };
        active().push(at);
        break;
      case 'Q': {
        // A quadratic is a cubic whose two controls have been raised from its
        // one, so a single flattener answers for both rather than two that
        // could disagree about the same curve.
        const end = { x: segment.x, y: segment.y };
        const [first, second] = quadraticControls(at, segment);
        flattenCubic(at, first, second, end, within, 0, active());
        at = end;
        break;
      }
      case 'C': {
        const end = { x: segment.x, y: segment.y };
        flattenCubic(
          at,
          { x: segment.x1, y: segment.y1 },
          { x: segment.x2, y: segment.y2 },
          end,
          within,
          0,
          active(),
        );
        at = end;
        break;
      }
      case 'A': {
        const points = flattenArc(at, segment, within);
        if (points.length > 0) {
          const target = active();
          for (const point of points) target.push(point);
        }
        at = { x: segment.x, y: segment.y };
        break;
      }
      case 'Z':
        // The closing edge is a real edge: without it the last side of a
        // filled path would be missing from both its box and its hit test.
        if (run) run.push(opened);
        at = opened;
        break;
    }
  }
  return runs.filter((points) => points.length > 0);
}

/** A point on a circle, at a bearing in degrees clockwise from east. */
function pointAt(cx: number, cy: number, radius: number, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
}

/** One `A` command onto `point`, along a circle of `radius`. */
function arcSegment(
  radius: number,
  degrees: number,
  clockwise: boolean,
  point: Point,
): PathSegment {
  return {
    c: 'A',
    rx: radius,
    ry: radius,
    rotation: 0,
    large: Math.abs(degrees) > 180,
    sweep: clockwise,
    x: point.x,
    y: point.y,
  };
}

/**
 * The two `A` commands a full circle takes, from `start` back to it.
 *
 * One cannot do it: an arc is stated by the point it ends at, and for a whole
 * turn that is the point it began at — which SVG reads as an arc of no length
 * and draws nothing at all. Halving it gives each arc two distinct ends.
 */
function circleSegments(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  clockwise: boolean,
): PathSegment[] {
  const half = clockwise ? 180 : -180;
  return [
    arcSegment(radius, half, clockwise, pointAt(cx, cy, radius, start + half)),
    arcSegment(radius, half, clockwise, pointAt(cx, cy, radius, start + half * 2)),
  ];
}

/**
 * A circular arc, wedge or donut segment as a path. `inner` of 0 gives a
 * wedge; equal to `r`, an open arc.
 *
 * Angles are degrees clockwise from east, which is the convention `lineAngle`
 * already reads in. Like the hexagon preset this is a generator and not a
 * kind: what comes back is an ordinary list of commands, and nothing
 * afterwards remembers it was ever an arc.
 *
 * A wedge and a donut segment close, so they are regions and take a fill; an
 * open arc does not, so it is a run drawn by its stroke.
 */
export function arcPath(shape: {
  cx: number;
  cy: number;
  r: number;
  inner: number;
  start: number;
  sweep: number;
}): PathSegment[] {
  const { cx, cy, start } = shape;
  const r = Math.max(0, shape.r);
  // A hole wider than the shape is not a shape; the far end of that range is
  // an open arc, which is the same thing said sensibly.
  const inner = Math.min(Math.max(0, shape.inner), r);
  const sweep = Math.max(-360, Math.min(360, shape.sweep));
  if (r <= 0 || sweep === 0) return [];

  const clockwise = sweep >= 0;
  const whole = Math.abs(sweep) >= 360;
  const finish = start + sweep;
  const outerStart = pointAt(cx, cy, r, start);
  const outerEnd = pointAt(cx, cy, r, finish);

  if (inner >= r) {
    const move: PathSegment = { c: 'M', x: outerStart.x, y: outerStart.y };
    // Left open even when it comes back to its own start: a ring drawn by its
    // stroke is a run, and closing it would make it a region with a fill.
    return whole
      ? [move, ...circleSegments(cx, cy, r, start, clockwise)]
      : [move, arcSegment(r, sweep, clockwise, outerEnd)];
  }

  if (inner === 0) {
    if (whole) {
      return [
        { c: 'M', x: outerStart.x, y: outerStart.y },
        ...circleSegments(cx, cy, r, start, clockwise),
        { c: 'Z' },
      ];
    }
    // Starting at the centre rather than closing back to it puts the wedge's
    // point where it belongs in the command order, and `Z` then draws the
    // second straight side rather than a third.
    return [
      { c: 'M', x: cx, y: cy },
      { c: 'L', x: outerStart.x, y: outerStart.y },
      arcSegment(r, sweep, clockwise, outerEnd),
      { c: 'Z' },
    ];
  }

  const innerStart = pointAt(cx, cy, inner, start);
  const innerEnd = pointAt(cx, cy, inner, finish);
  if (whole) {
    // Two closed subpaths, wound opposite ways. Even-odd would leave the hole
    // either way, but SVG fills with the non-zero rule by default and two
    // rings turning the same way would fill solid.
    return [
      { c: 'M', x: outerStart.x, y: outerStart.y },
      ...circleSegments(cx, cy, r, start, clockwise),
      { c: 'Z' },
      { c: 'M', x: innerStart.x, y: innerStart.y },
      ...circleSegments(cx, cy, inner, start, !clockwise),
      { c: 'Z' },
    ];
  }
  return [
    { c: 'M', x: outerStart.x, y: outerStart.y },
    arcSegment(r, sweep, clockwise, outerEnd),
    { c: 'L', x: innerEnd.x, y: innerEnd.y },
    arcSegment(inner, -sweep, !clockwise, innerStart),
    { c: 'Z' },
  ];
}

/**
 * The object's axis-aligned box before rotation, in document units.
 *
 * Anything drawn as a stroked run — a line, a polyline, a polygon's outline —
 * has its box inflated by half its stroke on each side: a horizontal line has
 * zero height as a segment, but the thing you see and click is as tall as its
 * stroke, and the selection outline has to agree with the pixels.
 */
export function bounds(object: IconObject): Box {
  const g = object.geometry;
  const half = object.strokeWidth / 2;
  switch (g.kind) {
    case 'circle':
      return { x: g.cx - g.r, y: g.cy - g.r, w: g.r * 2, h: g.r * 2 };
    case 'line':
      return inflate(
        pointsBox([
          { x: g.x1, y: g.y1 },
          { x: g.x2, y: g.y2 },
        ]),
        half,
      );
    case 'polyline':
    case 'polygon':
      return inflate(pointsBox(g.points), half);
    case 'path':
      // Boxed by the flattened curve, never by the control points: a cubic's
      // handles can sit well outside the shape they steer, and a box drawn
      // round them would leave the selection outline nowhere near the artwork.
      return inflate(pointsBox(flattenPath(g.segments).flat()), half);
    case 'rect':
    case 'ellipse':
      return { x: g.x, y: g.y, w: g.w, h: g.h };
  }
}

export function centreOf(object: IconObject): Point {
  const b = bounds(object);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

export const boxCentre = (box: Box): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

/**
 * The bearing of a line, in degrees clockwise from east, 0–359.
 *
 * A line has no separate rotation: its two points already say which way it
 * runs, so this IS its angle. Storing a rotation beside them would make the
 * pivot — the midpoint — move whenever either end did, and the far end would
 * then drift every time you dragged the near one.
 */
export function lineAngle(geometry: Extract<Geometry, { kind: 'line' }>): number {
  const degrees =
    (Math.atan2(geometry.y2 - geometry.y1, geometry.x2 - geometry.x1) * 180) / Math.PI;
  return ((degrees % 360) + 360) % 360;
}

/** Turn a line to a new bearing about its own midpoint, leaving its length alone. */
export function aimLine(
  geometry: Extract<Geometry, { kind: 'line' }>,
  degrees: number,
): Extract<Geometry, { kind: 'line' }> {
  const pivot = {
    x: (geometry.x1 + geometry.x2) / 2,
    y: (geometry.y1 + geometry.y2) / 2,
  };
  const turn = degrees - lineAngle(geometry);
  const a = rotatePoint({ x: geometry.x1, y: geometry.y1 }, pivot, turn);
  const b = rotatePoint({ x: geometry.x2, y: geometry.y2 }, pivot, turn);
  return { ...geometry, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

/**
 * A line's two endpoints in artboard space, with the object's rotation already
 * applied — which is where its handles actually have to be drawn.
 */
export function lineEndpoints(object: IconObject): [Point, Point] {
  const g = object.geometry;
  if (g.kind !== 'line') throw new Error('lineEndpoints called on a non-line object');
  const centre = centreOf(object);
  return [
    rotatePoint({ x: g.x1, y: g.y1 }, centre, object.rotation),
    rotatePoint({ x: g.x2, y: g.y2 }, centre, object.rotation),
  ];
}

/**
 * One on-path point of a path, with the command it ends.
 *
 * A path's draggable points are its anchors and nothing else. `Z` has none of
 * its own — it returns to a point another command already stated — and a
 * control point is not *on* the curve at all: it steers it from outside, which
 * is why it gets a handle of its own shape rather than a place in this list.
 */
export interface PathAnchor {
  /** Where it sits, in stored units — before the object's rotation. */
  point: Point;
  /** Which command in `segments` ends here. */
  segment: number;
}

/** Every anchor of a path, in the order its commands are written. */
export function pathAnchors(segments: readonly PathSegment[]): PathAnchor[] {
  const anchors: PathAnchor[] = [];
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (!segment || segment.c === 'Z') continue;
    anchors.push({ point: { x: segment.x, y: segment.y }, segment: index });
  }
  return anchors;
}

/**
 * One control point, named by the command that holds it and which of that
 * command's two it is: `1` for `x1`/`y1`, `2` for `x2`/`y2`.
 */
export interface PathControl {
  point: Point;
  segment: number;
  which: 1 | 2;
}

/** A command's control point, or null when it has none of that number. */
export function controlPointAt(
  segments: readonly PathSegment[],
  segment: number,
  which: 1 | 2,
): Point | null {
  const command = segments[segment];
  if (!command) return null;
  if (which === 1 && (command.c === 'C' || command.c === 'Q')) {
    return { x: command.x1, y: command.y1 };
  }
  if (which === 2 && command.c === 'C') return { x: command.x2, y: command.y2 };
  return null;
}

/**
 * The control points an anchor owns: the second control of the command
 * *arriving* at it, and the first control of the command *leaving* it.
 *
 * That rule gives every control exactly one owner — a cubic's `x1` belongs to
 * the anchor it leaves and its `x2` to the anchor it reaches, and a quadratic's
 * single control belongs to the anchor it leaves. The partition is what lets a
 * node drag carry its handles without two neighbouring nodes both claiming the
 * same control and moving it twice; it also decides, with no further rule, that
 * `which === 2` is the handle coming in and `which === 1` the one going out.
 */
export function anchorControls(
  segments: readonly PathSegment[],
  segment: number,
): PathControl[] {
  const controls: PathControl[] = [];
  const arriving = controlPointAt(segments, segment, 2);
  if (arriving) controls.push({ point: arriving, segment, which: 2 });
  const leaving = controlPointAt(segments, segment + 1, 1);
  if (leaving) controls.push({ point: leaving, segment: segment + 1, which: 1 });
  return controls;
}

/** A control point with the artboard-space position its handle is drawn at. */
export interface ControlHandlePoint extends PathControl {
  at: Point;
}

/**
 * The control handles belonging to one anchor, in artboard space with the
 * object's rotation applied — the same answer `vertexPoints` gives for the
 * anchors themselves, for the points that steer between them.
 *
 * Asked one anchor at a time on purpose: a forty-node path with every handle on
 * screen is a thicket, so only the node you selected shows what steers it.
 */
export function anchorControlPoints(object: IconObject, anchorIndex: number): ControlHandlePoint[] {
  const g = object.geometry;
  if (g.kind !== 'path') return [];
  const anchor = pathAnchors(g.segments)[anchorIndex];
  if (!anchor) return [];
  const centre = centreOf(object);
  return anchorControls(g.segments, anchor.segment).map((control) => ({
    ...control,
    at: rotatePoint(control.point, centre, object.rotation),
  }));
}

/**
 * Every point a shape is dragged by, in artboard space, with the object's
 * rotation already applied — which is where its handles actually have to be
 * drawn. Empty for the shapes that are dragged by a box instead.
 *
 * A line's two ends, a point list's vertices and a path's anchors are the same
 * thing wearing different names, so one function answers for all of them and
 * the overlay does not have to know which kind it is looking at — which is also
 * what lets one vertex gesture reshape all four without a mode of its own.
 */
export function vertexPoints(object: IconObject): Point[] {
  const g = object.geometry;
  if (g.kind === 'line') return lineEndpoints(object);
  if (g.kind === 'path') {
    const centre = centreOf(object);
    return pathAnchors(g.segments).map((anchor) =>
      rotatePoint(anchor.point, centre, object.rotation),
    );
  }
  if (g.kind !== 'polyline' && g.kind !== 'polygon') return [];
  const centre = centreOf(object);
  return g.points.map((point) => rotatePoint(point, centre, object.rotation));
}

/**
 * A regular polygon's vertices, first one directly above the centre.
 *
 * Starting at −90° rather than 0° is what makes a triangle point up and a
 * hexagon sit flat-sided, which is what anyone drawing an icon expects.
 */
export function polygonPoints(cx: number, cy: number, r: number, sides: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    points.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return points;
}

/**
 * Rotate a point about another. Exported because the selection layer has to
 * move between the artboard's frame and an object's own: a rotated object is
 * resized by rotating the pointer *into* its frame, resizing there, and
 * rotating the result back.
 */
export function rotatePoint(point: Point, about: Point, degrees: number): Point {
  if (degrees === 0) return point;
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - about.x;
  const dy = point.y - about.y;
  return { x: about.x + dx * cos - dy * sin, y: about.y + dx * sin + dy * cos };
}

/**
 * How far the object reaches from the artboard's centre, as a fraction of the
 * distance to its edge — the number Android's maskable rule is stated against.
 *
 * Measured per axis rather than against one half-width, so a wide board is
 * judged by how much of *itself* an object covers. Rotation is applied first:
 * a square turned 45° reaches further than its unrotated box does, and the
 * platform crops what is actually drawn.
 */
export function extentOf(object: IconObject, artboard: { width: number; height: number }): number {
  const b = bounds(object);
  const halfW = artboard.width / 2;
  const halfH = artboard.height / 2;
  if (halfW <= 0 || halfH <= 0) return 0;
  const middle = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const corners: Point[] = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x, y: b.y + b.h },
    { x: b.x + b.w, y: b.y + b.h },
  ];
  let furthest = 0;
  for (const corner of corners) {
    const turned = rotatePoint(corner, middle, object.rotation);
    furthest = Math.max(
      furthest,
      Math.abs(turned.x - halfW) / halfW,
      Math.abs(turned.y - halfH) / halfH,
    );
  }
  return furthest;
}

/**
 * The axis-aligned box the object actually occupies once its rotation is
 * applied — where a rotated shape actually sits on the artboard, which is not
 * what its own `x`/`y`/`w`/`h` say, since those describe the geometry before
 * the transform and are what gets exported.
 */
export function rotatedBounds(object: IconObject): Box {
  const box = bounds(object);
  if (object.rotation === 0) return box;
  const centre = centreOf(object);
  const corners: Point[] = [
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x, y: box.y + box.h },
    { x: box.x + box.w, y: box.y + box.h },
  ];
  const turned = corners.map((corner) => rotatePoint(corner, centre, object.rotation));
  const xs = turned.map((point) => point.x);
  const ys = turned.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

function pointInBox(point: Point, box: Box): boolean {
  return (
    point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h
  );
}

function pointInEllipse(point: Point, box: Box): boolean {
  const rx = box.w / 2;
  const ry = box.h / 2;
  if (rx === 0 || ry === 0) return false;
  const dx = (point.x - (box.x + rx)) / rx;
  const dy = (point.y - (box.y + ry)) / ry;
  return dx * dx + dy * dy <= 1;
}

/** Even-odd containment for a closed polygon. */
function pointInPolygon(point: Point, vertices: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i];
    const b = vertices[j];
    if (!a || !b) continue;
    const straddles = a.y > point.y !== b.y > point.y;
    if (!straddles) continue;
    const crossingX = a.x + ((point.y - a.y) / (b.y - a.y)) * (b.x - a.x);
    if (point.x < crossingX) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * How close the pointer has to get to a stroked run to count as on it. A
 * hairline shape still has to be clickable, so the floor is one document unit
 * rather than the stroke width alone.
 */
const runReach = (object: IconObject): number => Math.max(object.strokeWidth, 1) / 2;

/** Whether the point is within `reach` of any segment of an open run. */
function nearRun(point: Point, run: readonly Point[], reach: number): boolean {
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1];
    const b = run[i];
    if (!a || !b) continue;
    if (distanceToSegment(point, a, b) <= reach) return true;
  }
  return false;
}

function containsUnrotated(geometry: Geometry, object: IconObject, point: Point): boolean {
  switch (geometry.kind) {
    case 'rect':
      return pointInBox(point, bounds(object));
    case 'circle':
    case 'ellipse':
      return pointInEllipse(point, bounds(object));
    case 'polygon':
      return pointInPolygon(point, geometry.points);
    case 'polyline':
      return nearRun(point, geometry.points, runReach(object));
    case 'path': {
      const runs = flattenPath(geometry.segments);
      // An open path has no inside to be in, so it is hit the way a polyline
      // is: near its stroke, and nowhere else.
      if (isOpenRun(geometry)) return runs.some((run) => nearRun(point, run, runReach(object)));
      // Even-odd across every subpath, which is what makes a hole a hole
      // rather than a second body drawn on top of the first.
      return runs.reduce((inside, run) => inside !== pointInPolygon(point, run), false);
    }
    case 'line':
      return nearRun(
        point,
        [
          { x: geometry.x1, y: geometry.y1 },
          { x: geometry.x2, y: geometry.y2 },
        ],
        runReach(object),
      );
  }
}

/**
 * Whether a document-space point is on the object.
 *
 * The point is rotated backwards into the object's own frame rather than the
 * object forwards into the artboard's, which keeps one containment test per
 * shape instead of one per shape per rotation.
 */
export function contains(object: IconObject, point: Point): boolean {
  const local = rotatePoint(point, centreOf(object), -object.rotation);
  return containsUnrotated(object.geometry, object, local);
}

/**
 * The frontmost object under the point, or null.
 *
 * Hidden objects are not there to be hit. Locked ones are: clicking a locked
 * object selects it so you can unlock it — locked means it will not move, not
 * that it has left the document.
 */
export function hitTest(objects: IconObject[], point: Point): IconObject | null {
  for (const object of objects) {
    if (object.hidden) continue;
    if (contains(object, point)) return object;
  }
  return null;
}

/** One path command moved, coordinates and all. */
function movedSegment(segment: PathSegment, dx: number, dy: number): PathSegment {
  switch (segment.c) {
    case 'M':
    case 'L':
      return { ...segment, x: segment.x + dx, y: segment.y + dy };
    case 'Q':
      return {
        ...segment,
        x1: segment.x1 + dx,
        y1: segment.y1 + dy,
        x: segment.x + dx,
        y: segment.y + dy,
      };
    case 'C':
      return {
        ...segment,
        x1: segment.x1 + dx,
        y1: segment.y1 + dy,
        x2: segment.x2 + dx,
        y2: segment.y2 + dy,
        x: segment.x + dx,
        y: segment.y + dy,
      };
    case 'A':
      return { ...segment, x: segment.x + dx, y: segment.y + dy };
    case 'Z':
      return segment;
  }
}

/**
 * Every command moved.
 *
 * Exported because reshaping a path has to translate one as well: a path turns
 * about the centre of its own box, so an edit that moves that box is put back
 * on screen by sliding the whole thing. Control points move with the curve they
 * steer, so it arrives the same shape it left, and an arc's radii are lengths
 * rather than positions and are left exactly alone — moving them would resize
 * the shape.
 */
export function translateSegments(
  segments: readonly PathSegment[],
  dx: number,
  dy: number,
): PathSegment[] {
  return segments.map((segment) => movedSegment(segment, dx, dy));
}

/** Move an object's geometry by a document-space delta. */
export function translate(geometry: Geometry, dx: number, dy: number): Geometry {
  switch (geometry.kind) {
    case 'line':
      return {
        ...geometry,
        x1: geometry.x1 + dx,
        y1: geometry.y1 + dy,
        x2: geometry.x2 + dx,
        y2: geometry.y2 + dy,
      };
    case 'circle':
      return { ...geometry, cx: geometry.cx + dx, cy: geometry.cy + dy };
    case 'polyline':
    case 'polygon':
      return {
        ...geometry,
        points: geometry.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
      };
    case 'path':
      return { ...geometry, segments: translateSegments(geometry.segments, dx, dy) };
    case 'rect':
    case 'ellipse':
      return { ...geometry, x: geometry.x + dx, y: geometry.y + dy };
  }
}

/**
 * Scale a run of points into `target`, which is stated in the same terms the
 * points already occupy — stroke inflation removed.
 *
 * A run with no extent along an axis has no ratio to scale by, so every point
 * collapses onto the target's own edge rather than being divided by zero.
 */
function fitPoints(points: readonly Point[], target: Box): Point[] {
  const current = pointsBox(points);
  const scaleX = current.w === 0 ? 0 : target.w / current.w;
  const scaleY = current.h === 0 ? 0 : target.h / current.h;
  return points.map((point) => ({
    x: target.x + (point.x - current.x) * scaleX,
    y: target.y + (point.y - current.y) * scaleY,
  }));
}

/**
 * Scale a path into `target`, stated in the same terms its flattened points
 * occupy — stroke inflation removed.
 *
 * The real commands are rewritten rather than the flattened run, so a curve
 * comes out a curve: control points scale with the points they steer, and an
 * arc's radii scale with the axis each belongs to.
 *
 * An `A` that is turned on its own axis would need that rotation rewritten too
 * when the axes scale by different amounts — a rotated ellipse squashed on one
 * axis is a differently rotated ellipse. Nothing in the editor makes one yet,
 * and the honest thing is to say so here rather than to leave it looking
 * handled.
 */
function fitPath(segments: readonly PathSegment[], target: Box): PathSegment[] {
  const current = pointsBox(flattenPath(segments).flat());
  const scaleX = current.w === 0 ? 0 : target.w / current.w;
  const scaleY = current.h === 0 ? 0 : target.h / current.h;
  const at = (x: number, y: number): Point => ({
    x: target.x + (x - current.x) * scaleX,
    y: target.y + (y - current.y) * scaleY,
  });

  return segments.map((segment): PathSegment => {
    switch (segment.c) {
      case 'M':
      case 'L':
        return { ...segment, ...at(segment.x, segment.y) };
      case 'Q': {
        const control = at(segment.x1, segment.y1);
        return { ...segment, x1: control.x, y1: control.y, ...at(segment.x, segment.y) };
      }
      case 'C': {
        const first = at(segment.x1, segment.y1);
        const second = at(segment.x2, segment.y2);
        return {
          ...segment,
          x1: first.x,
          y1: first.y,
          x2: second.x,
          y2: second.y,
          ...at(segment.x, segment.y),
        };
      }
      case 'A':
        return {
          ...segment,
          rx: segment.rx * scaleX,
          ry: segment.ry * scaleY,
          ...at(segment.x, segment.y),
        };
      case 'Z':
        return segment;
    }
  });
}

/**
 * Rewrite a geometry so its bounding box becomes `box`.
 *
 * Every shape has to answer this the same way for one resize interaction to
 * work on all of them. A circle stays circular — it takes the smaller
 * half-extent as its radius rather than becoming an ellipse, which is a
 * different element — and a line keeps its diagonal direction while its
 * endpoints move to the new box's corners.
 *
 * Anything stroked deflates the box by half its stroke first, because that is
 * what `bounds` added: without it, resizing a shape to the box it already
 * reports would shrink it a little more on every pass.
 */
export function fitToBox(object: IconObject, box: Box): Geometry {
  const g = object.geometry;
  const half = object.strokeWidth / 2;
  const inner: Box = {
    x: box.x + half,
    y: box.y + half,
    w: Math.max(0, box.w - object.strokeWidth),
    h: Math.max(0, box.h - object.strokeWidth),
  };
  switch (g.kind) {
    case 'circle':
      return {
        ...g,
        cx: box.x + box.w / 2,
        cy: box.y + box.h / 2,
        r: Math.max(0, Math.min(box.w, box.h) / 2),
      };
    case 'polyline':
    case 'polygon':
      return { ...g, points: fitPoints(g.points, inner) };
    case 'path':
      return { ...g, segments: fitPath(g.segments, inner) };
    case 'line': {
      const leftToRight = g.x2 >= g.x1;
      const topToBottom = g.y2 >= g.y1;
      const right = inner.x + inner.w;
      const bottom = inner.y + inner.h;
      return {
        ...g,
        x1: leftToRight ? inner.x : right,
        x2: leftToRight ? right : inner.x,
        y1: topToBottom ? inner.y : bottom,
        y2: topToBottom ? bottom : inner.y,
      };
    }
    case 'rect':
    case 'ellipse':
      return { ...g, x: box.x, y: box.y, w: Math.max(0, box.w), h: Math.max(0, box.h) };
  }
}

// ----- adding and removing a node -----------------------------------------

/** How far along the segment a→b the closest point to `point` sits, 0–1. */
function closestOnSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return 0;
  return Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
}

/** A cubic evaluated by de Casteljau, which is also how it is split. */
function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const a = lerp(p0, p1, t);
  const b = lerp(p1, p2, t);
  const c = lerp(p2, p3, t);
  return lerp(lerp(a, b, t), lerp(b, c, t), t);
}

/**
 * How many places along a curve are tried before the search narrows, and how
 * many times it then narrows.
 *
 * The exact answer is a root of a fifth-degree polynomial. A coarse sweep
 * followed by thirty narrowings of a 1/32 window lands far inside
 * FLATTEN_TOLERANCE and costs under a hundred evaluations, which is nothing for
 * something that happens once per double-click.
 */
const NEAREST_SAMPLES = 32;
const NEAREST_NARROWINGS = 30;

/** How far along a cubic the closest point to `point` sits, and how far away it is. */
function nearestOnCubic(
  point: Point,
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
): { t: number; distance: number } {
  const away = (t: number): number => {
    const on = cubicAt(p0, p1, p2, p3, t);
    return Math.hypot(on.x - point.x, on.y - point.y);
  };
  let best = 0;
  let bestDistance = away(0);
  for (let i = 1; i <= NEAREST_SAMPLES; i++) {
    const t = i / NEAREST_SAMPLES;
    const distance = away(t);
    if (distance < bestDistance) {
      best = t;
      bestDistance = distance;
    }
  }
  // Narrowed by thirds rather than halved: distance along a curve has no
  // derivative to bisect on, but it has one minimum inside a window this small,
  // and comparing two interior points always discards a third of it.
  let low = Math.max(0, best - 1 / NEAREST_SAMPLES);
  let high = Math.min(1, best + 1 / NEAREST_SAMPLES);
  for (let i = 0; i < NEAREST_NARROWINGS; i++) {
    const third = (high - low) / 3;
    if (away(low + third) <= away(high - third)) high -= third;
    else low += third;
  }
  const t = (low + high) / 2;
  return { t, distance: away(t) };
}

/** Where a point falls on a path. */
export interface PathHit {
  /** Index into `segments` of the command it landed on. */
  segment: number;
  /** How far along that command, 0–1. Meaningless on an `A`, which is not split. */
  t: number;
  /** The point on the curve itself. */
  point: Point;
  distance: number;
}

/** The nearest point on a run of straight points, reported as a hit on `segment`. */
function nearestOnRun(point: Point, run: readonly Point[], segment: number): PathHit | null {
  let best: PathHit | null = null;
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1];
    const b = run[i];
    if (!a || !b) continue;
    const t = closestOnSegment(point, a, b);
    const on = lerp(a, b, t);
    const distance = Math.hypot(on.x - point.x, on.y - point.y);
    if (!best || distance < best.distance) best = { segment, t, point: on, distance };
  }
  return best;
}

/**
 * Which command of a path the point is nearest to, where along it, and how far.
 *
 * Solved against each command's own maths rather than against the flattened
 * run, because the answer is what a split is then performed with: a `t` read
 * off a chord of the flattened curve is not the `t` the curve itself has there,
 * and splitting at the wrong parameter moves the outline.
 */
export function nearestOnPath(segments: readonly PathSegment[], point: Point): PathHit | null {
  const hits: PathHit[] = [];
  let at: Point = { x: 0, y: 0 };
  let opened: Point = at;

  const straight = (index: number, to: Point): void => {
    const t = closestOnSegment(point, at, to);
    const on = lerp(at, to, t);
    hits.push({
      segment: index,
      t,
      point: on,
      distance: Math.hypot(on.x - point.x, on.y - point.y),
    });
  };
  const curved = (index: number, p1: Point, p2: Point, p3: Point): void => {
    const near = nearestOnCubic(point, at, p1, p2, p3);
    hits.push({
      segment: index,
      t: near.t,
      point: cubicAt(at, p1, p2, p3, near.t),
      distance: near.distance,
    });
  };

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (!segment) continue;
    switch (segment.c) {
      case 'M':
        // Nothing is drawn on the way to a move, so there is no edge here for a
        // node to land on.
        at = { x: segment.x, y: segment.y };
        opened = at;
        break;
      case 'L': {
        const end = { x: segment.x, y: segment.y };
        straight(index, end);
        at = end;
        break;
      }
      case 'Q': {
        const end = { x: segment.x, y: segment.y };
        const [first, second] = quadraticControls(at, segment);
        curved(index, first, second, end);
        at = end;
        break;
      }
      case 'C': {
        const end = { x: segment.x, y: segment.y };
        curved(index, { x: segment.x1, y: segment.y1 }, { x: segment.x2, y: segment.y2 }, end);
        at = end;
        break;
      }
      case 'A': {
        // Measured on the flattened arc. An arc is never split, so all this has
        // to decide is whether the arc is what the pointer was nearest to.
        const hit = nearestOnRun(point, [at, ...flattenArc(at, segment, FLATTEN_TOLERANCE)], index);
        if (hit) hits.push({ ...hit, t: 0 });
        at = { x: segment.x, y: segment.y };
        break;
      }
      case 'Z':
        straight(index, opened);
        at = opened;
        break;
    }
  }
  return hits.reduce<PathHit | null>(
    (best, hit) => (best !== null && best.distance <= hit.distance ? best : hit),
    null,
  );
}

/** Where the pen stands, and where its subpath opened, just before command `index`. */
function penBefore(segments: readonly PathSegment[], index: number): { at: Point; opened: Point } {
  let at: Point = { x: 0, y: 0 };
  let opened: Point = at;
  for (let i = 0; i < index; i++) {
    const segment = segments[i];
    if (!segment) continue;
    if (segment.c === 'Z') {
      at = opened;
      continue;
    }
    at = { x: segment.x, y: segment.y };
    if (segment.c === 'M') opened = at;
  }
  return { at, opened };
}

/**
 * The commands with the one at `hit` cut in two where it was hit, or null when
 * that command cannot be cut.
 *
 * A straight cut is trivial. A curve is cut with de Casteljau, which is exact:
 * the two halves *are* the original curve, so adding a node does not move the
 * outline by so much as a unit. Dropping a point onto the curve and guessing
 * fresh handles for it — the obvious shortcut — visibly shifts the shape, which
 * is the one thing adding a node must never do.
 *
 * An `A` is refused rather than approximated. Splitting one exactly means two
 * arcs sharing the split point, each keeping the original radii and axis
 * rotation with the large-arc flag recomputed from the sweep each now covers.
 * That needs the centre parameterisation this file only derives inside the
 * flattener; the alternative — quietly turning the arc into cubics — would
 * rewrite commands nobody asked to have rewritten. Declining is the honest
 * answer until the exact one is written.
 */
export function splitPath(segments: readonly PathSegment[], hit: PathHit): PathSegment[] | null {
  const segment = segments[hit.segment];
  if (!segment) return null;
  const { at, opened } = penBefore(segments, hit.segment);
  const next = segments.slice();

  switch (segment.c) {
    case 'A':
    case 'M':
      return null;
    case 'Z': {
      // The closing edge is drawn but has no command of its own, so the node
      // lands on an `L` put in front of the `Z` — which draws the same edge in
      // two parts and leaves the `Z` closing the second of them.
      const on = lerp(at, opened, hit.t);
      next.splice(hit.segment, 0, { c: 'L', x: on.x, y: on.y });
      return next;
    }
    case 'L': {
      const on = lerp(at, { x: segment.x, y: segment.y }, hit.t);
      next.splice(hit.segment, 1, { c: 'L', x: on.x, y: on.y }, segment);
      return next;
    }
    case 'Q': {
      const end = { x: segment.x, y: segment.y };
      const control = { x: segment.x1, y: segment.y1 };
      const a = lerp(at, control, hit.t);
      const b = lerp(control, end, hit.t);
      const on = lerp(a, b, hit.t);
      next.splice(
        hit.segment,
        1,
        { c: 'Q', x1: a.x, y1: a.y, x: on.x, y: on.y },
        { c: 'Q', x1: b.x, y1: b.y, x: end.x, y: end.y },
      );
      return next;
    }
    case 'C': {
      const p1 = { x: segment.x1, y: segment.y1 };
      const p2 = { x: segment.x2, y: segment.y2 };
      const p3 = { x: segment.x, y: segment.y };
      const a = lerp(at, p1, hit.t);
      const b = lerp(p1, p2, hit.t);
      const c = lerp(p2, p3, hit.t);
      const d = lerp(a, b, hit.t);
      const e = lerp(b, c, hit.t);
      const on = lerp(d, e, hit.t);
      next.splice(
        hit.segment,
        1,
        { c: 'C', x1: a.x, y1: a.y, x2: d.x, y2: d.y, x: on.x, y: on.y },
        { c: 'C', x1: e.x, y1: e.y, x2: c.x, y2: c.y, x: p3.x, y: p3.y },
      );
      return next;
    }
  }
}

/** Where a new point belongs in a run of stored points, and where on the edge it lands. */
function insertOnRun(
  points: readonly Point[],
  at: Point,
  closed: boolean,
): { index: number; point: Point; distance: number } | null {
  let best: { index: number; point: Point; distance: number } | null = null;
  // A closed run has one more edge than it has gaps between listed points: the
  // one back from the last to the first, which is as clickable as any other.
  const edges = closed ? points.length : points.length - 1;
  for (let i = 0; i < edges; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b) continue;
    const t = closestOnSegment(at, a, b);
    const on = lerp(a, b, t);
    const distance = Math.hypot(on.x - at.x, on.y - at.y);
    // The new point goes after the one that starts the edge it landed on, so it
    // sits between exactly the two neighbours it was dropped between.
    if (!best || distance < best.distance) best = { index: i + 1, point: on, distance };
  }
  return best;
}

export interface VertexInsertion {
  geometry: Geometry;
  /** The new node's place in `vertexPoints`, so the caller can select it. */
  index: number;
}

/**
 * The geometry with a node added at the point of its outline nearest `at`, or
 * null when there is nothing there to add one to.
 *
 * `at` is in artboard space and is turned back into the object's own frame the
 * way `contains` does, so a rotated shape needs no special case. `reach` is in
 * document units, and it is what makes this a click on the *outline* rather
 * than on the object: without it a double-click in the middle of a filled
 * polygon would plant a node on whichever edge happened to be closest, nowhere
 * near the pointer.
 */
export function insertVertex(object: IconObject, at: Point, reach: number): VertexInsertion | null {
  const g = object.geometry;
  const local = rotatePoint(at, centreOf(object), -object.rotation);

  if (g.kind === 'polyline' || g.kind === 'polygon') {
    const found = insertOnRun(g.points, local, g.kind === 'polygon');
    if (!found || found.distance > reach) return null;
    const points = g.points.slice();
    points.splice(found.index, 0, found.point);
    return { geometry: { ...g, points }, index: found.index };
  }

  if (g.kind !== 'path') return null;
  const hit = nearestOnPath(g.segments, local);
  if (!hit || hit.distance > reach) return null;
  const segments = splitPath(g.segments, hit);
  if (!segments) return null;
  // However it was cut, the new node ends the command that was cut: the second
  // half is always written after it.
  const index = pathAnchors(segments).findIndex((anchor) => anchor.segment === hit.segment);
  return index < 0 ? null : { geometry: { ...g, segments }, index };
}

/**
 * The commands with the one ending at `index` taken out.
 *
 * Removing a move is the awkward case: the subpath still has to start
 * somewhere, so the command after it becomes the new move — and it becomes a
 * plain move rather than keeping its curve, because the point it curved *from*
 * is the one being deleted.
 */
function withoutAnchor(segments: readonly PathSegment[], index: number): PathSegment[] {
  const next = segments.slice();
  const removed = next[index];
  if (!removed) return next;
  if (removed.c !== 'M') {
    next.splice(index, 1);
    return next;
  }
  const following = next[index + 1];
  if (following && following.c !== 'M' && following.c !== 'Z') {
    next.splice(index, 2, { c: 'M', x: following.x, y: following.y });
    return next;
  }
  // Nothing was drawn from it, so the move goes — and so does a `Z` that would
  // otherwise be left closing nothing.
  next.splice(index, following?.c === 'Z' ? 2 : 1);
  return next;
}

/**
 * The geometry with node `index` removed, or null when removing it would take
 * the shape below the floor its kind stands on.
 *
 * The floors are what each SVG element needs in order to still BE that element:
 * a line is two points and never fewer, a polyline is at least two, a polygon
 * at least three, and a path has to keep a move with something to draw after
 * it. Below those the answer is null and the caller does nothing at all —
 * deleting the whole object instead would be a different command quietly
 * answering for this one.
 */
export function removeVertex(object: IconObject, index: number): Geometry | null {
  const g = object.geometry;

  if (g.kind === 'polyline' || g.kind === 'polygon') {
    const floor = g.kind === 'polygon' ? 3 : 2;
    if (g.points.length <= floor || index < 0 || index >= g.points.length) return null;
    const points = g.points.slice();
    points.splice(index, 1);
    return { ...g, points };
  }

  if (g.kind !== 'path') return null;
  const anchor = pathAnchors(g.segments)[index];
  if (!anchor) return null;
  const segments = withoutAnchor(g.segments, anchor.segment);
  // A move with one command after it is two anchors, and the least a path can
  // be while still drawing anything.
  if (pathAnchors(segments).length < 2) return null;
  if (!segments.some((segment) => segment.c === 'M')) return null;
  return { ...g, segments };
}
