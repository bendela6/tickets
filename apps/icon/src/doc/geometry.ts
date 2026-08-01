import type { Geometry, IconObject, Point, ShapeKind } from './types';

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
 */
export const isOpenRun = (kind: ShapeKind): boolean => kind === 'line' || kind === 'polyline';

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
 * Every point a shape is dragged by, in artboard space, with the object's
 * rotation already applied — which is where its handles actually have to be
 * drawn. Empty for the shapes that are dragged by a box instead.
 *
 * A line's two ends and a point list's vertices are the same thing wearing
 * different names, so one function answers for all three and the overlay does
 * not have to know which kind it is looking at.
 */
export function vertexPoints(object: IconObject): Point[] {
  const g = object.geometry;
  if (g.kind === 'line') return lineEndpoints(object);
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
