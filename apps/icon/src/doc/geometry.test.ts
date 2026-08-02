import { describe, expect, it } from 'vitest';
import { newObject } from './defaults';
import {
  anchorControlPoints,
  anchorControls,
  arcPath,
  boxCentre,
  boxesOverlap,
  bounds,
  centreOf,
  contains,
  extentOf,
  fitToBox,
  FLATTEN_TOLERANCE,
  flattenPath,
  hitTest,
  insertVertex,
  isOpenRun,
  lineEndpoints,
  nearestOnPath,
  objectsInBox,
  pathAnchors,
  polygonPoints,
  removeVertex,
  rotatedBounds,
  splitPath,
  translate,
  unionBox,
  vertexPoints,
} from './geometry';
import type { IconObject, PathSegment, Point } from './types';

/** The 512-square board most of these fixtures assume. */
const BOARD = { width: 512, height: 512 };

const rect = (over: Partial<IconObject> = {}): IconObject => ({
  ...newObject('rect', 1, BOARD),
  ...over,
});

/** A shape with a given point list and no stroke, so its box is its points. */
const withPoints = (
  kind: 'polyline' | 'polygon',
  points: Point[],
  over: Partial<IconObject> = {},
): IconObject => ({
  ...newObject(kind, 1, BOARD),
  geometry: { kind, points },
  strokeWidth: 0,
  ...over,
});

/** A right triangle with legs of 100, its corner at the origin of the box. */
const TRIANGLE: Point[] = [
  { x: 100, y: 100 },
  { x: 200, y: 100 },
  { x: 100, y: 200 },
];

/** A path with a given command list and no stroke, so its box is its curve. */
const withPath = (segments: PathSegment[], over: Partial<IconObject> = {}): IconObject => ({
  ...newObject('path', 1, BOARD),
  geometry: { kind: 'path', segments },
  strokeWidth: 0,
  ...over,
});

/**
 * A cubic that bulges clear of the line between its own two ends. Its control
 * points reach y = −100; the curve itself only reaches −75, at (50, −75),
 * which is what separates a box drawn round the curve from one drawn round the
 * handles that steer it.
 */
const HUMP: PathSegment[] = [
  { c: 'M', x: 0, y: 0 },
  { c: 'C', x1: 0, y1: -100, x2: 100, y2: -100, x: 100, y: 0 },
];

/** A half circle of radius 10, bulging up from (0,0) to (20,0). */
const SEMI: PathSegment[] = [
  { c: 'M', x: 0, y: 0 },
  { c: 'A', rx: 10, ry: 10, rotation: 0, large: false, sweep: true, x: 20, y: 0 },
];

const firstRun = (segments: PathSegment[], tolerance?: number): Point[] =>
  flattenPath(segments, tolerance)[0] ?? [];

/** Where the HUMP cubic actually is at `t`, straight from the formula. */
function humpAt(t: number): Point {
  const u = 1 - t;
  return {
    x: 3 * u * t * t * 100 + t * t * t * 100,
    y: 3 * u * u * t * -100 + 3 * u * t * t * -100,
  };
}

/** How far a point sits from the nearest segment of a run. */
function offRun(point: Point, run: readonly Point[]): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1];
    const b = run[i];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : ((point.x - a.x) * dx + (point.y - a.y) * dy) / length;
    const held = Math.max(0, Math.min(1, t));
    nearest = Math.min(nearest, Math.hypot(point.x - (a.x + held * dx), point.y - (a.y + held * dy)));
  }
  return nearest;
}

/** Every `A` command in a path, for the tests that are about the flags. */
const arcsOf = (segments: readonly PathSegment[]) =>
  segments.flatMap((segment) => (segment.c === 'A' ? [segment] : []));

describe('polygonPoints', () => {
  it('puts the first vertex directly above the centre, so a triangle points up', () => {
    const [first] = polygonPoints(100, 100, 50, 3);
    expect(first?.x).toBeCloseTo(100);
    expect(first?.y).toBeCloseTo(50);
  });
  it('spaces vertices evenly around the circle', () => {
    const points = polygonPoints(0, 0, 10, 6);
    expect(points).toHaveLength(6);
    for (const p of points) expect(Math.hypot(p.x, p.y)).toBeCloseTo(10);
  });
});

describe('flattenPath', () => {
  it('leaves a straight run exactly as it was stated, inventing no points', () => {
    expect(
      flattenPath([
        { c: 'M', x: 0, y: 0 },
        { c: 'L', x: 10, y: 20 },
      ]),
    ).toEqual([[{ x: 0, y: 0 }, { x: 10, y: 20 }]]);
  });

  it('starts a new run at every M, so a shape with a hole comes back as two', () => {
    const runs = flattenPath([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 10, y: 0 },
      { c: 'L', x: 10, y: 10 },
      { c: 'Z' },
      { c: 'M', x: 2, y: 2 },
      { c: 'L', x: 4, y: 2 },
      { c: 'L', x: 4, y: 4 },
      { c: 'Z' },
    ]);
    expect(runs).toHaveLength(2);
    expect(runs[1]?.[0]).toEqual({ x: 2, y: 2 });
  });

  it('closes a subpath back to where it started, because that edge is a real edge', () => {
    const run = firstRun([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 10, y: 0 },
      { c: 'L', x: 10, y: 10 },
      { c: 'Z' },
    ]);
    expect(run.at(-1)).toEqual({ x: 0, y: 0 });
  });

  it('holds a curve within the tolerance it is given', () => {
    const run = firstRun(HUMP, 0.05);
    let worst = 0;
    for (let i = 0; i <= 200; i++) worst = Math.max(worst, offRun(humpAt(i / 200), run));
    expect(worst).toBeLessThanOrEqual(0.05);
  });

  it('spends fewer points on a coarser tolerance, which is what the tolerance is for', () => {
    expect(firstRun(HUMP, 8).length).toBeLessThan(firstRun(HUMP, 0.05).length);
  });

  it('raises a quadratic to a cubic, so one flattener answers for both', () => {
    // The quadratic's own midpoint is halfway to its control point, at −50,
    // not at the −100 the control point itself sits at.
    const run = firstRun([
      { c: 'M', x: 0, y: 0 },
      { c: 'Q', x1: 50, y1: -100, x: 100, y: 0 },
    ]);
    expect(Math.min(...run.map((point) => point.y))).toBeCloseTo(-50, 5);
  });

  it('puts every sample of an arc on the arc', () => {
    const run = firstRun([
      { c: 'M', x: 100, y: 0 },
      { c: 'A', rx: 100, ry: 100, rotation: 0, large: false, sweep: true, x: -100, y: 0 },
    ]);
    expect(run.length).toBeGreaterThan(2);
    for (const point of run) expect(Math.hypot(point.x, point.y)).toBeCloseTo(100, 6);
  });

  it('draws an arc with no radius as the straight line SVG says it is', () => {
    expect(
      flattenPath([
        { c: 'M', x: 0, y: 0 },
        { c: 'A', rx: 0, ry: 0, rotation: 0, large: false, sweep: true, x: 10, y: 0 },
      ]),
    ).toEqual([[{ x: 0, y: 0 }, { x: 10, y: 0 }]]);
  });

  it('has nothing to return for a path with no commands', () => {
    expect(flattenPath([])).toEqual([]);
  });
});

describe('arcPath', () => {
  it('starts at the angle it is given, clockwise from east like every other bearing', () => {
    expect(arcPath({ cx: 0, cy: 0, r: 10, inner: 10, start: 0, sweep: 90 })[0]).toEqual({
      c: 'M',
      x: 10,
      y: 0,
    });
    const down = firstRun(arcPath({ cx: 0, cy: 0, r: 10, inner: 10, start: 0, sweep: 90 })).at(-1);
    // A quarter turn clockwise from east is south, which is +y on an artboard.
    expect(down?.x).toBeCloseTo(0, 6);
    expect(down?.y).toBeCloseTo(10, 6);
  });

  it('takes two arcs for a full turn, since one cannot describe a circle', () => {
    // A single A back to its own start point has coincident ends, and SVG
    // draws exactly nothing for it.
    const full = arcPath({ cx: 0, cy: 0, r: 10, inner: 10, start: 0, sweep: 360 });
    expect(full.map((segment) => segment.c)).toEqual(['M', 'A', 'A']);
  });

  it('a full turn draws the whole ring rather than nothing at all', () => {
    const ring = withPath(arcPath({ cx: 50, cy: 50, r: 40, inner: 40, start: -90, sweep: 360 }));
    const box = bounds(ring);
    // Flattening samples the curve, so the box can fall a tolerance short of
    // the true diameter and never further.
    expect(box.w).toBeGreaterThan(80 - 2 * FLATTEN_TOLERANCE);
    expect(box.w).toBeLessThanOrEqual(80);
    expect(box.h).toBeGreaterThan(80 - 2 * FLATTEN_TOLERANCE);
  });

  it('closes a wedge to its centre', () => {
    const wedge = arcPath({ cx: 0, cy: 0, r: 10, inner: 0, start: 0, sweep: 90 });
    expect(wedge.map((segment) => segment.c)).toEqual(['M', 'L', 'A', 'Z']);
    const run = firstRun(wedge);
    expect(run[0]).toEqual({ x: 0, y: 0 });
    expect(run.at(-1)).toEqual({ x: 0, y: 0 });
  });

  it('leaves an open arc open, so it is drawn by its stroke and not filled', () => {
    const arc = arcPath({ cx: 0, cy: 0, r: 10, inner: 10, start: 0, sweep: 90 });
    expect(arc.some((segment) => segment.c === 'Z')).toBe(false);
    const run = firstRun(arc);
    expect(run.at(-1)).not.toEqual(run[0]);
  });

  it('closes a donut segment through both of its radii', () => {
    const donut = arcPath({ cx: 0, cy: 0, r: 10, inner: 4, start: 0, sweep: 90 });
    expect(donut.map((segment) => segment.c)).toEqual(['M', 'A', 'L', 'A', 'Z']);
    // Out along the far radius, back along the near one.
    expect(arcsOf(donut).map((arc) => arc.rx)).toEqual([10, 4]);
    expect(arcsOf(donut).map((arc) => arc.sweep)).toEqual([true, false]);
  });

  it('winds a full donut’s two rings opposite ways, which is what leaves the hole', () => {
    const ring = arcPath({ cx: 0, cy: 0, r: 10, inner: 4, start: 0, sweep: 360 });
    expect(ring.map((segment) => segment.c)).toEqual(['M', 'A', 'A', 'Z', 'M', 'A', 'A', 'Z']);
    expect(arcsOf(ring).map((arc) => arc.sweep)).toEqual([true, true, false, false]);
  });

  it('takes the long way round only when the sweep asks for it', () => {
    const wide = arcPath({ cx: 0, cy: 0, r: 10, inner: 10, start: -90, sweep: 270 });
    const narrow = arcPath({ cx: 0, cy: 0, r: 10, inner: 10, start: -90, sweep: 90 });
    expect(arcsOf(wide).map((arc) => arc.large)).toEqual([true]);
    expect(arcsOf(narrow).map((arc) => arc.large)).toEqual([false]);
  });

  it('runs the other way for a negative sweep', () => {
    const back = arcPath({ cx: 0, cy: 0, r: 10, inner: 10, start: 0, sweep: -90 });
    expect(arcsOf(back).map((arc) => arc.sweep)).toEqual([false]);
  });

  it('clamps a hole wider than the shape back to an open arc', () => {
    expect(arcPath({ cx: 0, cy: 0, r: 10, inner: 40, start: 0, sweep: 90 })).toEqual(
      arcPath({ cx: 0, cy: 0, r: 10, inner: 10, start: 0, sweep: 90 }),
    );
  });

  it('has nothing to draw with no radius and nothing to draw with no sweep', () => {
    expect(arcPath({ cx: 0, cy: 0, r: 0, inner: 0, start: 0, sweep: 90 })).toEqual([]);
    expect(arcPath({ cx: 0, cy: 0, r: 10, inner: 0, start: 0, sweep: 0 })).toEqual([]);
  });
});

describe('bounds', () => {
  it('reads a rect straight off its geometry', () => {
    expect(bounds(rect())).toEqual({ x: 136, y: 136, w: 240, h: 240 });
  });

  it('inflates a line by its stroke, because that is what you can see and click', () => {
    // A horizontal segment has zero height; the drawn line is 20 units tall.
    const line = newObject('line', 1, BOARD);
    const box = bounds(line);
    expect(box.h).toBe(line.strokeWidth);
    expect(box.y).toBe(256 - line.strokeWidth / 2);
    expect(box.w).toBe(376 - 136 + line.strokeWidth);
  });

  it('boxes a circle by its radius', () => {
    const circle = newObject('circle', 1, BOARD);
    expect(bounds(circle)).toEqual({ x: 256 - 120, y: 256 - 120, w: 240, h: 240 });
  });

  it('boxes a point list by the points themselves, not by what they were made from', () => {
    // The hexagon preset's own extents: a flat-sided hexagon is narrower than
    // the circle it was generated on, and its box has to say so.
    expect(bounds(withPoints('polygon', TRIANGLE))).toEqual({ x: 100, y: 100, w: 100, h: 100 });
  });

  it('inflates a polyline by its stroke, for the same reason a line is inflated', () => {
    const run = withPoints('polyline', TRIANGLE, { strokeWidth: 10 });
    expect(bounds(run)).toEqual({ x: 95, y: 95, w: 110, h: 110 });
  });

  it('has somewhere to be even with no points at all, rather than reporting infinity', () => {
    const empty = withPoints('polyline', []);
    expect(bounds(empty)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('boxes a curve by the curve, not by the control points that steer it', () => {
    // The handles reach y = −100; the curve only reaches −75, and the box has
    // to hold the curve without holding the handles.
    const box = bounds(withPath(HUMP));
    expect(box.x).toBeCloseTo(0, 6);
    expect(box.w).toBeCloseTo(100, 6);
    expect(box.y).toBeCloseTo(-75, 6);
    expect(box.h).toBeCloseTo(75, 6);
  });

  it('inflates a path by its stroke, for the same reason a polyline is', () => {
    const stroked = withPath(
      [
        { c: 'M', x: 0, y: 0 },
        { c: 'L', x: 10, y: 0 },
      ],
      { strokeWidth: 4 },
    );
    expect(bounds(stroked)).toEqual({ x: -2, y: -2, w: 14, h: 4 });
  });
});

describe('isOpenRun', () => {
  const geometryOf = (kind: Parameters<typeof newObject>[0]) => newObject(kind, 1, BOARD).geometry;

  it('names the shapes with length and no area, which are drawn by their stroke', () => {
    expect((['line', 'polyline'] as const).map(geometryOf).map(isOpenRun)).toEqual([true, true]);
    expect(
      (['rect', 'circle', 'ellipse', 'polygon'] as const).map(geometryOf).map(isOpenRun),
    ).toEqual([false, false, false, false]);
  });

  it('lets a path answer for itself: one that closes is a region, one that does not is a run', () => {
    const arc = arcPath({ cx: 0, cy: 0, r: 10, inner: 10, start: 0, sweep: 270 });
    const wedge = arcPath({ cx: 0, cy: 0, r: 10, inner: 0, start: 0, sweep: 270 });
    expect(isOpenRun({ kind: 'path', segments: arc })).toBe(true);
    expect(isOpenRun({ kind: 'path', segments: wedge })).toBe(false);
  });
});

describe('rotatedBounds', () => {
  it('is exactly the unrotated bounds at 0°, since there is no transform to apply', () => {
    const square = rect({ geometry: { kind: 'rect', x: 156, y: 156, w: 200, h: 200, radius: 0 } });
    expect(rotatedBounds(square)).toEqual(bounds(square));
  });

  it('grows a square to its diagonal at 45°, keeping the same centre', () => {
    const square = rect({
      geometry: { kind: 'rect', x: 156, y: 156, w: 200, h: 200, radius: 0 },
      rotation: 45,
    });
    const box = rotatedBounds(square);
    expect(box.w).toBeCloseTo(200 * Math.SQRT2, 5);
    expect(box.h).toBeCloseTo(200 * Math.SQRT2, 5);
    const centre = boxCentre(box);
    expect(centre.x).toBeCloseTo(centreOf(square).x, 6);
    expect(centre.y).toBeCloseTo(centreOf(square).y, 6);
  });

  it('swaps width and height at 90°, turning the box on its side', () => {
    const wide = rect({
      geometry: { kind: 'rect', x: 100, y: 200, w: 300, h: 100, radius: 0 },
      rotation: 90,
    });
    const box = rotatedBounds(wide);
    expect(box.w).toBeCloseTo(100, 5);
    expect(box.h).toBeCloseTo(300, 5);
    const centre = boxCentre(box);
    expect(centre.x).toBeCloseTo(centreOf(wide).x, 6);
    expect(centre.y).toBeCloseTo(centreOf(wide).y, 6);
  });
});

describe('extentOf', () => {
  it('measures the furthest reach from the artboard centre as a fraction of the half-width', () => {
    // The design's `backdrop`: a 448-wide box inset 32 on a 512 board.
    const backdrop = rect({
      geometry: { kind: 'rect', x: 32, y: 32, w: 448, h: 448, radius: 96 },
    });
    expect(Math.round(extentOf(backdrop, BOARD) * 100)).toBe(88);
  });

  it('counts rotation, because the platform crops what is actually drawn', () => {
    const square = rect({ geometry: { kind: 'rect', x: 156, y: 156, w: 200, h: 200, radius: 0 } });
    const upright = extentOf(square, BOARD);
    const turned = extentOf({ ...square, rotation: 45 }, BOARD);
    expect(turned).toBeGreaterThan(upright);
    // A 200-square turned 45° has a half-diagonal of 100·√2.
    expect(turned).toBeCloseTo((100 * Math.SQRT2) / 256, 5);
  });

  it('is 1 for an object that exactly fills the board', () => {
    const full = rect({ geometry: { kind: 'rect', x: 0, y: 0, w: 512, h: 512, radius: 0 } });
    expect(extentOf(full, BOARD)).toBe(1);
  });
});

describe('contains', () => {
  it('excludes the corners of an ellipse that its box would include', () => {
    const ellipse = newObject('ellipse', 1, BOARD);
    expect(contains(ellipse, { x: 256, y: 256 })).toBe(true);
    expect(contains(ellipse, { x: 137, y: 137 })).toBe(false);
  });

  it('follows a rotated rect rather than its unrotated box', () => {
    const square = rect({
      geometry: { kind: 'rect', x: 206, y: 206, w: 100, h: 100, radius: 0 },
      rotation: 45,
    });
    // Just inside the upright box's corner, but outside the diamond.
    expect(contains(square, { x: 210, y: 210 })).toBe(false);
    expect(contains(square, { x: 256, y: 215 })).toBe(true);
  });

  it('gives a line the width of its stroke to be hit in', () => {
    const line = newObject('line', 1, BOARD);
    expect(contains(line, { x: 256, y: 256 })).toBe(true);
    expect(contains(line, { x: 256, y: 256 + line.strokeWidth })).toBe(false);
  });

  it('excludes the notches between a polygon’s vertices', () => {
    const triangle = withPoints('polygon', TRIANGLE);
    expect(contains(triangle, { x: 120, y: 120 })).toBe(true);
    // Bottom-right of the box: inside it, outside the triangle's hypotenuse.
    expect(contains(triangle, { x: 190, y: 190 })).toBe(false);
  });

  it('keeps a circle round, so its box corners are not on it', () => {
    const circle = newObject('circle', 1, BOARD);
    expect(contains(circle, { x: 256, y: 256 })).toBe(true);
    expect(contains(circle, { x: 137, y: 137 })).toBe(false);
  });

  it('gives a polyline the width of its stroke along every segment, and no area', () => {
    const run = withPoints('polyline', TRIANGLE, { strokeWidth: 10 });
    // On the first segment, which runs from (100,100) to (200,100).
    expect(contains(run, { x: 150, y: 103 })).toBe(true);
    // Between the ends of the open run: inside the box, on no segment.
    expect(contains(run, { x: 160, y: 160 })).toBe(false);
  });

  it('fills a path that closes, so its inside is hit and the ground past it is not', () => {
    const wedge = withPath(arcPath({ cx: 100, cy: 100, r: 50, inner: 0, start: 0, sweep: 90 }));
    expect(contains(wedge, { x: 120, y: 110 })).toBe(true);
    // Inside the wedge's own box, past the arc that bounds it.
    expect(contains(wedge, { x: 148, y: 148 })).toBe(false);
  });

  it('gives an open path the width of its stroke and no inside at all', () => {
    const spinner = withPath(
      arcPath({ cx: 100, cy: 100, r: 50, inner: 50, start: -90, sweep: 270 }),
      { strokeWidth: 8 },
    );
    expect(contains(spinner, { x: 100, y: 50 })).toBe(true);
    // The middle of a spinner is the hole in the middle of a spinner.
    expect(contains(spinner, { x: 100, y: 100 })).toBe(false);
  });

  it('leaves the hole in a donut unhit, which is what even-odd is for', () => {
    const donut = withPath(arcPath({ cx: 100, cy: 100, r: 50, inner: 20, start: 0, sweep: 360 }));
    expect(contains(donut, { x: 135, y: 100 })).toBe(true);
    expect(contains(donut, { x: 100, y: 100 })).toBe(false);
  });

  it('closes a polygon and leaves a polyline open, on the same points', () => {
    const closed = withPoints('polygon', TRIANGLE);
    const open = withPoints('polyline', TRIANGLE);
    const inside = { x: 120, y: 120 };
    expect(contains(closed, inside)).toBe(true);
    expect(contains(open, inside)).toBe(false);
  });
});

describe('hitTest', () => {
  const front = rect({ id: 'front' });
  const back = rect({ id: 'back' });

  it('returns the frontmost object, which is the first in document order', () => {
    expect(hitTest([front, back], { x: 256, y: 256 })?.id).toBe('front');
  });

  it('skips hidden objects — they are not there to be hit', () => {
    expect(hitTest([{ ...front, hidden: true }, back], { x: 256, y: 256 })?.id).toBe('back');
  });

  it('still hits a locked object, so it can be selected and unlocked', () => {
    expect(hitTest([{ ...front, locked: true }], { x: 256, y: 256 })?.id).toBe('front');
  });

  it('returns null on empty ground', () => {
    expect(hitTest([front], { x: 10, y: 10 })).toBeNull();
  });
});

describe('objectsInBox', () => {
  /** A hundred-unit square with its corner at `at`. */
  const square = (id: string, at: number): IconObject =>
    rect({ id, geometry: { kind: 'rect', x: at, y: at, w: 100, h: 100, radius: 0 } });

  const near = square('near', 0);
  const far = square('far', 300);
  /** A band across the gap: over a corner of the far square, nowhere near the other. */
  const BAND = { x: 250, y: 250, w: 100, h: 100 };

  it('catches what it overlaps, without having to contain it', () => {
    expect(objectsInBox([near, far], BAND).map((o) => o.id)).toEqual(['far']);
  });

  it('takes them front to back, the order the document is in', () => {
    expect(objectsInBox([near, far], { x: 0, y: 0, w: 512, h: 512 }).map((o) => o.id)).toEqual([
      'near',
      'far',
    ]);
  });

  it('skips a hidden object and still takes a locked one', () => {
    expect(objectsInBox([{ ...far, hidden: true }], BAND)).toEqual([]);
    expect(objectsInBox([{ ...far, locked: true }], BAND).map((o) => o.id)).toEqual(['far']);
  });

  it('measures a turned shape by where it actually lands', () => {
    // Turned 45° about its own centre at 350, the square's corners swing out
    // past the box it is stored as — and this band only reaches 290.
    const corner = { x: 280, y: 340, w: 10, h: 10 };
    expect(objectsInBox([{ ...far, rotation: 45 }], corner).map((o) => o.id)).toEqual(['far']);
    expect(objectsInBox([far], corner)).toEqual([]);
  });

  it('catches nothing on empty ground', () => {
    expect(objectsInBox([near, far], { x: 150, y: 150, w: 50, h: 50 })).toEqual([]);
  });
});

describe('unionBox', () => {
  it('holds every box it is given', () => {
    expect(
      unionBox([
        { x: 10, y: 20, w: 30, h: 40 },
        { x: 100, y: 0, w: 10, h: 10 },
      ]),
    ).toEqual({ x: 10, y: 0, w: 100, h: 60 });
  });

  it('has nothing to hold when there are no boxes', () => {
    expect(unionBox([])).toBeNull();
  });
});

describe('boxesOverlap', () => {
  const box = { x: 0, y: 0, w: 10, h: 10 };

  it('is true when they share area and false when they merely pass by', () => {
    expect(boxesOverlap(box, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(boxesOverlap(box, { x: 11, y: 0, w: 10, h: 10 })).toBe(false);
  });

  it('counts a shared edge, so a band drawn along one is not a miss', () => {
    expect(boxesOverlap(box, { x: 10, y: 0, w: 10, h: 10 })).toBe(true);
  });
});

describe('lineEndpoints', () => {
  it('returns the two ends as stored when the line is upright', () => {
    const line = newObject('line', 1, BOARD);
    expect(lineEndpoints(line)).toEqual([
      { x: 136, y: 256 },
      { x: 376, y: 256 },
    ]);
  });

  it('applies the object’s rotation, because that is where the handles have to be', () => {
    const line = { ...newObject('line', 1, BOARD), rotation: 90 };
    const [start, end] = lineEndpoints(line);
    // A horizontal line turned a quarter turn about its own centre (256,256).
    expect(start.x).toBeCloseTo(256, 6);
    expect(start.y).toBeCloseTo(136, 6);
    expect(end.x).toBeCloseTo(256, 6);
    expect(end.y).toBeCloseTo(376, 6);
  });

  it('refuses a shape that has no endpoints rather than inventing some', () => {
    expect(() => lineEndpoints(newObject('rect', 1, BOARD))).toThrow(/non-line/);
  });
});

describe('translate', () => {
  it('moves both endpoints of a line, keeping its direction', () => {
    const moved = translate({ kind: 'line', x1: 0, y1: 0, x2: 10, y2: 20 }, 5, -5);
    expect(moved).toEqual({ kind: 'line', x1: 5, y1: -5, x2: 15, y2: 15 });
  });
  it('moves a circle by its centre', () => {
    expect(translate({ kind: 'circle', cx: 10, cy: 10, r: 4 }, 3, 3)).toEqual({
      kind: 'circle',
      cx: 13,
      cy: 13,
      r: 4,
    });
  });

  it('moves every point of a run, so its shape is untouched', () => {
    expect(translate({ kind: 'polygon', points: TRIANGLE }, 5, -5)).toEqual({
      kind: 'polygon',
      points: [
        { x: 105, y: 95 },
        { x: 205, y: 95 },
        { x: 105, y: 195 },
      ],
    });
  });

  it('moves an arc’s endpoint and leaves its radii alone, a radius being no position', () => {
    const moved = translate(
      {
        kind: 'path',
        segments: [
          { c: 'M', x: 0, y: 0 },
          { c: 'A', rx: 8, ry: 4, rotation: 30, large: true, sweep: false, x: 10, y: 20 },
        ],
      },
      5,
      -5,
    );
    expect(moved).toEqual({
      kind: 'path',
      segments: [
        { c: 'M', x: 5, y: -5 },
        { c: 'A', rx: 8, ry: 4, rotation: 30, large: true, sweep: false, x: 15, y: 15 },
      ],
    });
  });

  it('moves a curve’s control points with it, so it arrives the shape it left', () => {
    expect(
      translate(
        { kind: 'path', segments: [{ c: 'C', x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 }] },
        10,
        10,
      ),
    ).toEqual({ kind: 'path', segments: [{ c: 'C', x1: 11, y1: 12, x2: 13, y2: 14, x: 15, y: 16 }] });
  });
});

describe('vertexPoints', () => {
  it('is empty for the shapes dragged by a box, which have no points to drag', () => {
    for (const kind of ['rect', 'circle', 'ellipse'] as const) {
      expect(vertexPoints(newObject(kind, 1, BOARD))).toEqual([]);
    }
  });

  it('is a path’s anchors: the endpoint of every command but Z, in order', () => {
    // Upright, so the anchors come back as exactly the stored numbers. `Z`
    // returns to a point the `M` already stated and contributes none of its own.
    expect(
      vertexPoints(
        withPath([
          { c: 'M', x: 10, y: 10 },
          { c: 'L', x: 90, y: 10 },
          { c: 'C', x1: 90, y1: 60, x2: 60, y2: 90, x: 10, y: 90 },
          { c: 'Z' },
        ]),
      ),
    ).toEqual([
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 10, y: 90 },
    ]);
  });

  it('gives the arc preset a handle at each end of the arc it draws', () => {
    const arc = newObject('path', 1, BOARD);
    expect(vertexPoints(arc)).toHaveLength(2);
  });

  it('applies the object’s rotation to a path’s anchors too', () => {
    const turned = withPath(
      [
        { c: 'M', x: 100, y: 100 },
        { c: 'L', x: 200, y: 200 },
      ],
      { rotation: 180 },
    );
    const centre = centreOf(turned);
    const [first] = vertexPoints(turned);
    expect(first?.x).toBeCloseTo(centre.x + 50, 6);
    expect(first?.y).toBeCloseTo(centre.y + 50, 6);
  });

  it('is a line’s two ends, so one overlay serves every shape made of points', () => {
    const line = newObject('line', 1, BOARD);
    expect(vertexPoints(line)).toEqual(lineEndpoints(line));
  });

  it('returns a point list as stored while the shape is upright', () => {
    expect(vertexPoints(withPoints('polygon', TRIANGLE))).toEqual(TRIANGLE);
  });

  it('applies the object’s rotation, because that is where the handles have to be', () => {
    const turned = withPoints('polygon', TRIANGLE, { rotation: 90 });
    const centre = centreOf(turned);
    const [first] = vertexPoints(turned);
    // (100,100) is the box's top-left; a quarter turn takes it to the top-right.
    expect(first?.x).toBeCloseTo(centre.x + 50, 6);
    expect(first?.y).toBeCloseTo(centre.y - 50, 6);
  });
});

describe('fitToBox', () => {
  it('keeps a circle circular by taking the smaller half-extent as its radius', () => {
    const circle = newObject('circle', 1, BOARD);
    expect(fitToBox(circle, { x: 0, y: 0, w: 200, h: 80 })).toEqual({
      kind: 'circle',
      cx: 100,
      cy: 40,
      r: 40,
    });
  });

  it('scales a point list into the new box, proportionally on each axis', () => {
    const fitted = fitToBox(withPoints('polygon', TRIANGLE), { x: 0, y: 0, w: 200, h: 50 });
    expect(fitted).toEqual({
      kind: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 200, y: 0 },
        { x: 0, y: 50 },
      ],
    });
  });

  it('leaves room for the stroke, so a run resized to its own box does not creep inwards', () => {
    const run = withPoints('polyline', TRIANGLE, { strokeWidth: 10 });
    expect(fitToBox(run, bounds(run))).toEqual({ kind: 'polyline', points: TRIANGLE });
  });

  it('collapses a flat run onto the new box rather than dividing by its zero extent', () => {
    const flat = withPoints('polyline', [
      { x: 10, y: 0 },
      { x: 10, y: 40 },
    ]);
    const fitted = fitToBox(flat, { x: 100, y: 100, w: 0, h: 80 });
    expect(fitted).toEqual({
      kind: 'polyline',
      points: [
        { x: 100, y: 100 },
        { x: 100, y: 180 },
      ],
    });
  });

  it('keeps a line running the same way it did', () => {
    const line: IconObject = {
      ...newObject('line', 1, BOARD),
      geometry: { kind: 'line', x1: 100, y1: 200, x2: 0, y2: 0 },
      strokeWidth: 0,
    };
    // Ran right-to-left and bottom-to-top; must still do so in the new box.
    const fitted = fitToBox(line, { x: 10, y: 10, w: 100, h: 100 });
    expect(fitted).toEqual({ kind: 'line', x1: 110, y1: 110, x2: 10, y2: 10 });
  });

  it('scales an arc’s radii with the box, each on the axis it belongs to', () => {
    const arc = withPath(SEMI);
    const box = bounds(arc);
    const fitted = fitToBox(arc, { x: box.x, y: box.y, w: box.w * 2, h: box.h * 3 });
    if (fitted.kind !== 'path') throw new Error('expected a path');
    expect(fitted.segments[1]).toMatchObject({ c: 'A', rx: 20, ry: 30 });
  });

  it('keeps a curve a curve rather than the run it was measured through', () => {
    const fitted = fitToBox(withPath(HUMP), { x: 0, y: 0, w: 50, h: 50 });
    if (fitted.kind !== 'path') throw new Error('expected a path');
    expect(fitted.segments.map((segment) => segment.c)).toEqual(['M', 'C']);
  });

  it('puts a path in the box it is given, curve and all', () => {
    const arc = withPath(SEMI);
    const target = { x: 100, y: 100, w: 60, h: 30 };
    const landed = bounds({ ...arc, geometry: fitToBox(arc, target) });
    // Within the flattening tolerance on each edge: the box is measured
    // through an approximation, so it can only be as exact as that.
    expect(Math.abs(landed.x - target.x)).toBeLessThanOrEqual(FLATTEN_TOLERANCE);
    expect(Math.abs(landed.y - target.y)).toBeLessThanOrEqual(FLATTEN_TOLERANCE);
    expect(Math.abs(landed.w - target.w)).toBeLessThanOrEqual(2 * FLATTEN_TOLERANCE);
    expect(Math.abs(landed.h - target.h)).toBeLessThanOrEqual(2 * FLATTEN_TOLERANCE);
  });

  it('round-trips: fitting a shape to its own bounds changes nothing', () => {
    for (const kind of ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'] as const) {
      const object = newObject(kind, 1, BOARD);
      expect({ kind, geometry: fitToBox(object, bounds(object)) }).toEqual({
        kind,
        geometry: object.geometry,
      });
    }
  });

  it('round-trips a path as closely as an approximation allows', () => {
    const arc = newObject('path', 1, BOARD);
    const before = arc.geometry;
    const after = fitToBox(arc, bounds(arc));
    if (before.kind !== 'path' || after.kind !== 'path') throw new Error('expected a path');
    expect(after.segments).toHaveLength(before.segments.length);
    after.segments.forEach((segment, index) => {
      const was = before.segments[index];
      expect(segment.c).toBe(was?.c);
      if (!was || was.c === 'Z' || segment.c === 'Z') return;
      expect(segment.x).toBeCloseTo(was.x, 3);
      expect(segment.y).toBeCloseTo(was.y, 3);
    });
  });

  it('never produces a negative size', () => {
    const fitted = fitToBox(rect(), { x: 0, y: 0, w: -50, h: -50 });
    expect(fitted).toMatchObject({ w: 0, h: 0 });
  });
});

/** Two cubics meeting at (100,0), so the middle anchor has a handle either side. */
const BOW: PathSegment[] = [
  { c: 'M', x: 0, y: 0 },
  { c: 'C', x1: 20, y1: -60, x2: 80, y2: -60, x: 100, y: 0 },
  { c: 'C', x1: 120, y1: 60, x2: 180, y2: 60, x: 200, y: 0 },
];

describe('pathAnchors', () => {
  it('names each anchor by the command it ends, skipping the one with no point', () => {
    expect(
      pathAnchors([
        { c: 'M', x: 1, y: 2 },
        { c: 'L', x: 3, y: 4 },
        { c: 'Z' },
        { c: 'M', x: 5, y: 6 },
      ]),
    ).toEqual([
      { point: { x: 1, y: 2 }, segment: 0 },
      { point: { x: 3, y: 4 }, segment: 1 },
      { point: { x: 5, y: 6 }, segment: 3 },
    ]);
  });
});

describe('anchorControls', () => {
  it('gives an anchor the control arriving at it and the one leaving it', () => {
    // The middle anchor of the bow ends command 1 and starts command 2.
    expect(anchorControls(BOW, 1)).toEqual([
      { point: { x: 80, y: -60 }, segment: 1, which: 2 },
      { point: { x: 120, y: 60 }, segment: 2, which: 1 },
    ]);
  });

  it('gives every control exactly one owner, so no anchor drag moves one twice', () => {
    const owners = new Map<string, number>();
    for (const anchor of pathAnchors(BOW)) {
      for (const control of anchorControls(BOW, anchor.segment)) {
        const key = `${control.segment}-${control.which}`;
        owners.set(key, (owners.get(key) ?? 0) + 1);
      }
    }
    expect([...owners.values()].every((count) => count === 1)).toBe(true);
    // All four controls of the two cubics are accounted for.
    expect(owners.size).toBe(4);
  });

  it('hands a quadratic’s single control to the anchor it leaves', () => {
    const quad: PathSegment[] = [
      { c: 'M', x: 0, y: 0 },
      { c: 'Q', x1: 50, y1: 100, x: 100, y: 0 },
    ];
    expect(anchorControls(quad, 0)).toEqual([{ point: { x: 50, y: 100 }, segment: 1, which: 1 }]);
    // And not to the one it arrives at, which would claim it a second time.
    expect(anchorControls(quad, 1)).toEqual([]);
  });

  it('has nothing to offer a straight command, which is steered by nothing', () => {
    expect(
      anchorControls(
        [
          { c: 'M', x: 0, y: 0 },
          { c: 'L', x: 10, y: 0 },
        ],
        1,
      ),
    ).toEqual([]);
  });
});

describe('anchorControlPoints', () => {
  it('places a control where its handle has to be drawn, rotation and all', () => {
    const upright = withPath(BOW);
    const turned = withPath(BOW, { rotation: 90 });
    const centre = centreOf(turned);
    const [incoming] = anchorControlPoints(turned, 1);
    const [flat] = anchorControlPoints(upright, 1);
    expect(flat?.at).toEqual({ x: 80, y: -60 });
    // A quarter turn about the centre takes (dx, dy) to (−dy, dx).
    expect(incoming?.at.x).toBeCloseTo(centre.x - (-60 - centre.y), 6);
    expect(incoming?.at.y).toBeCloseTo(centre.y + (80 - centre.x), 6);
  });

  it('is empty for a shape that is not a path, and for a node that is not there', () => {
    expect(anchorControlPoints(withPoints('polygon', TRIANGLE), 0)).toEqual([]);
    expect(anchorControlPoints(withPath(BOW), 9)).toEqual([]);
  });
});

describe('nearestOnPath', () => {
  it('picks the command the point is actually nearest, not the first one near it', () => {
    const hit = nearestOnPath(BOW, { x: 150, y: 40 });
    expect(hit?.segment).toBe(2);
  });

  it('reports a straight command’s parameter as the fraction along it', () => {
    const hit = nearestOnPath(
      [
        { c: 'M', x: 0, y: 0 },
        { c: 'L', x: 100, y: 0 },
      ],
      { x: 25, y: 5 },
    );
    expect(hit?.t).toBeCloseTo(0.25, 6);
    expect(hit?.distance).toBeCloseTo(5, 6);
  });

  it('finds the closing edge, which is drawn but has no command of its own', () => {
    const square: PathSegment[] = [
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 100, y: 0 },
      { c: 'L', x: 100, y: 100 },
      { c: 'Z' },
    ];
    // Nearest the diagonal home run from (100,100) back to (0,0).
    expect(nearestOnPath(square, { x: 48, y: 52 })?.segment).toBe(3);
  });

  it('lands on the curve itself rather than on a chord across it', () => {
    const hit = nearestOnPath(HUMP, { x: 50, y: -200 });
    // The hump reaches y = −75 at its top, and that is where the point is.
    expect(hit?.point.x).toBeCloseTo(50, 4);
    expect(hit?.point.y).toBeCloseTo(-75, 4);
  });

  it('has nothing to report about a path with no commands', () => {
    expect(nearestOnPath([], { x: 0, y: 0 })).toBeNull();
  });
});

describe('splitPath', () => {
  /** How far the two outlines stray from each other, sampled point by point. */
  const strays = (before: PathSegment[], after: PathSegment[]): number => {
    const original = flattenPath(before, 0.01).flat();
    const split = flattenPath(after, 0.01);
    let worst = 0;
    for (const point of original) {
      worst = Math.min(...split.map((run) => offRun(point, run)));
      if (worst > FLATTEN_TOLERANCE) return worst;
    }
    return worst;
  };

  it('a cubic split leaves the outline where it was, within the flattening tolerance', () => {
    const hit = nearestOnPath(HUMP, { x: 30, y: -90 });
    expect(hit).not.toBeNull();
    const split = hit ? splitPath(HUMP, hit) : null;
    expect(split).not.toBeNull();
    if (!split) return;
    // The whole point of de Casteljau: two commands where there was one, and
    // not one unit of movement anywhere along the curve.
    expect(split).toHaveLength(3);
    expect(strays(HUMP, split)).toBeLessThanOrEqual(FLATTEN_TOLERANCE);
    expect(strays(split, HUMP)).toBeLessThanOrEqual(FLATTEN_TOLERANCE);
  });

  it('the new node sits exactly on the old curve, wherever it was cut', () => {
    for (const t of [0.15, 0.5, 0.83]) {
      const on = humpAt(t);
      const hit = nearestOnPath(HUMP, on);
      const split = hit ? splitPath(HUMP, hit) : null;
      const node = split ? pathAnchors(split)[1] : undefined;
      expect(node?.point.x).toBeCloseTo(on.x, 3);
      expect(node?.point.y).toBeCloseTo(on.y, 3);
    }
  });

  it('a quadratic split keeps it quadratic and keeps its outline', () => {
    const quad: PathSegment[] = [
      { c: 'M', x: 0, y: 0 },
      { c: 'Q', x1: 50, y1: 100, x: 100, y: 0 },
    ];
    const hit = nearestOnPath(quad, { x: 30, y: 45 });
    const split = hit ? splitPath(quad, hit) : null;
    expect(split?.map((segment) => segment.c)).toEqual(['M', 'Q', 'Q']);
    if (split) expect(strays(quad, split)).toBeLessThanOrEqual(FLATTEN_TOLERANCE);
  });

  it('a straight split is two straights along the same line', () => {
    const line: PathSegment[] = [
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 100, y: 0 },
    ];
    const hit = nearestOnPath(line, { x: 40, y: 3 });
    expect(hit ? splitPath(line, hit) : null).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 40, y: 0 },
      { c: 'L', x: 100, y: 0 },
    ]);
  });

  it('a closing edge splits into an L in front of the Z, which draws the same edge', () => {
    const triangle: PathSegment[] = [
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 100, y: 0 },
      { c: 'L', x: 100, y: 100 },
      { c: 'Z' },
    ];
    const hit = nearestOnPath(triangle, { x: 50, y: 50 });
    const split = hit ? splitPath(triangle, hit) : null;
    expect(split?.map((segment) => segment.c)).toEqual(['M', 'L', 'L', 'L', 'Z']);
    if (split) expect(strays(triangle, split)).toBeLessThanOrEqual(FLATTEN_TOLERANCE);
  });

  it('refuses to split an arc rather than approximating one', () => {
    // Stated as a refusal on purpose: an exact arc split is two arcs with the
    // large-arc flag recomputed, and turning the arc into cubics instead would
    // rewrite a command nobody asked to have rewritten.
    const hit = nearestOnPath(SEMI, { x: 10, y: -12 });
    expect(hit?.segment).toBe(1);
    expect(hit ? splitPath(SEMI, hit) : null).toBeNull();
  });

  it('refuses a move, which draws nothing for a node to land on', () => {
    expect(splitPath(HUMP, { segment: 0, t: 0.5, point: { x: 0, y: 0 }, distance: 0 })).toBeNull();
  });
});

describe('insertVertex', () => {
  it('lands a polygon’s new point between the two neighbours it was dropped between', () => {
    const object = withPoints('polygon', TRIANGLE);
    // Halfway down the edge from (200,100) to (100,200) — points 2 and 3.
    const added = insertVertex(object, { x: 150, y: 150 }, 4);
    expect(added?.index).toBe(2);
    expect(added?.geometry).toEqual({
      kind: 'polygon',
      points: [TRIANGLE[0], TRIANGLE[1], { x: 150, y: 150 }, TRIANGLE[2]],
    });
  });

  it('uses a polygon’s closing edge, which is as clickable as any other', () => {
    const added = insertVertex(withPoints('polygon', TRIANGLE), { x: 100, y: 150 }, 4);
    // The run home from (100,200) to (100,100) — so the new point goes last.
    expect(added?.index).toBe(3);
    expect(added?.geometry).toMatchObject({ points: [...TRIANGLE, { x: 100, y: 150 }] });
  });

  it('leaves a polyline’s ends open, having no edge to close', () => {
    const chevron: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 0 },
    ];
    // Nearer the imaginary line from the last point back to the first than to
    // either real edge — and there is no such edge on an open run.
    const added = insertVertex(withPoints('polyline', chevron), { x: 50, y: -40 }, 100);
    expect(added?.index).not.toBe(3);
  });

  it('refuses a click that is not near the outline at all', () => {
    // Deep inside a filled triangle: the nearest edge is a long way off, and
    // planting a node there would put it nowhere near the pointer.
    expect(insertVertex(withPoints('polygon', TRIANGLE), { x: 120, y: 120 }, 2)).toBeNull();
  });

  it('reads through the object’s rotation, so a turned shape needs no special case', () => {
    const turned = withPoints('polygon', TRIANGLE, { rotation: 90 });
    const centre = centreOf(turned);
    // Where the midpoint of edge 2 ends up after a quarter turn.
    const midpoint = { x: 150, y: 150 };
    const onScreen = {
      x: centre.x - (midpoint.y - centre.y),
      y: centre.y + (midpoint.x - centre.x),
    };
    expect(insertVertex(turned, onScreen, 1)?.index).toBe(2);
  });

  it('splits the path command that was hit and selects the node it made', () => {
    const object = withPath(HUMP);
    const added = insertVertex(object, humpAt(0.5), 5);
    expect(added?.index).toBe(1);
    expect(added?.geometry).toMatchObject({ kind: 'path' });
  });

  it('gives a shape with no nodes nothing to add one to', () => {
    for (const kind of ['rect', 'circle', 'ellipse', 'line'] as const) {
      const object = newObject(kind, 1, BOARD);
      expect(insertVertex(object, centreOf(object), 1000)).toBeNull();
    }
  });

  it('adds nothing to a path whose only command near the pointer is an arc', () => {
    expect(insertVertex(withPath(SEMI), { x: 10, y: -10 }, 5)).toBeNull();
  });
});

describe('removeVertex', () => {
  it('takes the point out of a point list and leaves the order alone', () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(removeVertex(withPoints('polygon', square), 1)).toEqual({
      kind: 'polygon',
      points: [square[0], square[2], square[3]],
    });
  });

  it('holds a polygon at three points, which is the least that is still a polygon', () => {
    expect(removeVertex(withPoints('polygon', TRIANGLE), 0)).toBeNull();
  });

  it('holds a polyline at two points, which is the least that is still a run', () => {
    const pair: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(removeVertex(withPoints('polyline', pair), 1)).toBeNull();
    // One more and it does give.
    expect(removeVertex(withPoints('polyline', [...pair, { x: 20, y: 0 }]), 1)).toMatchObject({
      points: [pair[0], { x: 20, y: 0 }],
    });
  });

  it('never lets a line drop an end, a line being two points by definition', () => {
    const line = newObject('line', 1, BOARD);
    expect(removeVertex(line, 0)).toBeNull();
    expect(removeVertex(line, 1)).toBeNull();
  });

  it('holds a path at a move and one command after it', () => {
    // The arc preset is exactly that: one `M` and one `A`.
    const arc = newObject('path', 1, BOARD);
    expect(removeVertex(arc, 0)).toBeNull();
    expect(removeVertex(arc, 1)).toBeNull();
  });

  it('drops a path command, and the anchors after it keep their order', () => {
    expect(removeVertex(withPath(BOW), 1)).toEqual({
      kind: 'path',
      segments: [BOW[0], BOW[2]],
    });
  });

  it('promotes the next command when the move itself is removed', () => {
    // The subpath still has to start somewhere, and it starts where the second
    // node already was — as a plain move, the curve into it having gone with
    // the point it curved from.
    expect(removeVertex(withPath(BOW), 0)).toEqual({
      kind: 'path',
      segments: [{ c: 'M', x: 100, y: 0 }, BOW[2]],
    });
  });

  it('has nothing to remove for the shapes with no nodes, or for a node that is not there', () => {
    expect(removeVertex(rect(), 0)).toBeNull();
    expect(removeVertex(withPath(BOW), 9)).toBeNull();
  });
});
