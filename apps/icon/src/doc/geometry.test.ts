import { describe, expect, it } from 'vitest';
import { newObject } from './defaults';
import {
  boxCentre,
  bounds,
  centreOf,
  contains,
  extentOf,
  fitToBox,
  hitTest,
  isOpenRun,
  lineEndpoints,
  polygonPoints,
  rotatedBounds,
  translate,
  vertexPoints,
} from './geometry';
import type { IconObject, Point } from './types';

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
});

describe('isOpenRun', () => {
  it('names the shapes with length and no area, which are drawn by their stroke', () => {
    expect((['line', 'polyline'] as const).map(isOpenRun)).toEqual([true, true]);
    expect((['rect', 'circle', 'ellipse', 'polygon'] as const).map(isOpenRun)).toEqual([
      false,
      false,
      false,
      false,
    ]);
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
});

describe('vertexPoints', () => {
  it('is empty for the shapes dragged by a box, which have no points to drag', () => {
    for (const kind of ['rect', 'circle', 'ellipse'] as const) {
      expect(vertexPoints(newObject(kind, 1, BOARD))).toEqual([]);
    }
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

  it('round-trips: fitting a shape to its own bounds changes nothing', () => {
    for (const kind of ['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'] as const) {
      const object = newObject(kind, 1, BOARD);
      expect({ kind, geometry: fitToBox(object, bounds(object)) }).toEqual({
        kind,
        geometry: object.geometry,
      });
    }
  });

  it('never produces a negative size', () => {
    const fitted = fitToBox(rect(), { x: 0, y: 0, w: -50, h: -50 });
    expect(fitted).toMatchObject({ w: 0, h: 0 });
  });
});
