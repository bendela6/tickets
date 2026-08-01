import type { Geometry, IconObject } from './types';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * The object's axis-aligned box before rotation, in document units.
 *
 * A line's box is inflated by half its stroke on each side: a horizontal line
 * has zero height as a segment, but the thing you see and click is as tall as
 * its stroke, and the selection outline has to agree with the pixels.
 */
export function bounds(object: IconObject): Box {
  const g = object.geometry;
  switch (g.kind) {
    case 'polygon':
      return { x: g.cx - g.r, y: g.cy - g.r, w: g.r * 2, h: g.r * 2 };
    case 'line': {
      const half = object.strokeWidth / 2;
      return {
        x: Math.min(g.x1, g.x2) - half,
        y: Math.min(g.y1, g.y2) - half,
        w: Math.abs(g.x2 - g.x1) + object.strokeWidth,
        h: Math.abs(g.y2 - g.y1) + object.strokeWidth,
      };
    }
    default:
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

function containsUnrotated(geometry: Geometry, object: IconObject, point: Point): boolean {
  switch (geometry.kind) {
    case 'rect':
      return pointInBox(point, bounds(object));
    case 'ellipse':
      return pointInEllipse(point, bounds(object));
    case 'polygon':
      return pointInPolygon(
        point,
        polygonPoints(geometry.cx, geometry.cy, geometry.r, geometry.sides),
      );
    case 'line':
      return (
        distanceToSegment(
          point,
          { x: geometry.x1, y: geometry.y1 },
          { x: geometry.x2, y: geometry.y2 },
        ) <=
        Math.max(object.strokeWidth, 1) / 2
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
    case 'polygon':
      return { ...geometry, cx: geometry.cx + dx, cy: geometry.cy + dy };
    default:
      return { ...geometry, x: geometry.x + dx, y: geometry.y + dy };
  }
}

/**
 * Rewrite a geometry so its bounding box becomes `box`.
 *
 * Every shape has to answer this the same way for one resize interaction to
 * work on all four. A polygon stays regular — it takes the smaller half-extent
 * as its radius rather than becoming an ellipse-like thing no longer describable
 * as a polygon — and a line keeps its diagonal direction while its endpoints
 * move to the new box's corners.
 */
export function fitToBox(object: IconObject, box: Box): Geometry {
  const g = object.geometry;
  switch (g.kind) {
    case 'polygon':
      return {
        ...g,
        cx: box.x + box.w / 2,
        cy: box.y + box.h / 2,
        r: Math.max(0, Math.min(box.w, box.h) / 2),
      };
    case 'line': {
      const half = object.strokeWidth / 2;
      const leftToRight = g.x2 >= g.x1;
      const topToBottom = g.y2 >= g.y1;
      const left = box.x + half;
      const right = box.x + box.w - half;
      const top = box.y + half;
      const bottom = box.y + box.h - half;
      return {
        ...g,
        x1: leftToRight ? left : right,
        x2: leftToRight ? right : left,
        y1: topToBottom ? top : bottom,
        y2: topToBottom ? bottom : top,
      };
    }
    default:
      return { ...g, x: box.x, y: box.y, w: Math.max(0, box.w), h: Math.max(0, box.h) };
  }
}
