import { describe, expect, it } from 'vitest';
import { newObject } from './defaults';
import { bounds, contains, extentOf, fitToBox, hitTest, polygonPoints, translate } from './geometry';
import type { IconObject } from './types';

const rect = (over: Partial<IconObject> = {}): IconObject => ({
  ...newObject('rect', 1, 512),
  ...over,
});

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
    const line = newObject('line', 1, 512);
    const box = bounds(line);
    expect(box.h).toBe(line.strokeWidth);
    expect(box.y).toBe(256 - line.strokeWidth / 2);
    expect(box.w).toBe(376 - 136 + line.strokeWidth);
  });

  it('boxes a polygon by its circumradius', () => {
    const poly = newObject('polygon', 1, 512);
    expect(bounds(poly)).toEqual({ x: 256 - 120, y: 256 - 120, w: 240, h: 240 });
  });
});

describe('extentOf', () => {
  it('measures the furthest reach from the artboard centre as a fraction of the half-width', () => {
    // The design's `backdrop`: a 448-wide box inset 32 on a 512 board.
    const backdrop = rect({
      geometry: { kind: 'rect', x: 32, y: 32, w: 448, h: 448, radius: 96 },
    });
    expect(Math.round(extentOf(backdrop, 512) * 100)).toBe(88);
  });

  it('counts rotation, because the platform crops what is actually drawn', () => {
    const square = rect({ geometry: { kind: 'rect', x: 156, y: 156, w: 200, h: 200, radius: 0 } });
    const upright = extentOf(square, 512);
    const turned = extentOf({ ...square, rotation: 45 }, 512);
    expect(turned).toBeGreaterThan(upright);
    // A 200-square turned 45° has a half-diagonal of 100·√2.
    expect(turned).toBeCloseTo((100 * Math.SQRT2) / 256, 5);
  });

  it('is 1 for an object that exactly fills the board', () => {
    const full = rect({ geometry: { kind: 'rect', x: 0, y: 0, w: 512, h: 512, radius: 0 } });
    expect(extentOf(full, 512)).toBe(1);
  });
});

describe('contains', () => {
  it('excludes the corners of an ellipse that its box would include', () => {
    const ellipse = newObject('ellipse', 1, 512);
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
    const line = newObject('line', 1, 512);
    expect(contains(line, { x: 256, y: 256 })).toBe(true);
    expect(contains(line, { x: 256, y: 256 + line.strokeWidth })).toBe(false);
  });

  it('excludes the notches between a polygon’s vertices', () => {
    const triangle: IconObject = {
      ...newObject('polygon', 1, 512),
      geometry: { kind: 'polygon', cx: 256, cy: 256, r: 120, sides: 3 },
    };
    expect(contains(triangle, { x: 256, y: 256 })).toBe(true);
    // Top-left of the box: inside the circumcircle's box, outside the triangle.
    expect(contains(triangle, { x: 145, y: 145 })).toBe(false);
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

describe('translate', () => {
  it('moves both endpoints of a line, keeping its direction', () => {
    const moved = translate({ kind: 'line', x1: 0, y1: 0, x2: 10, y2: 20 }, 5, -5);
    expect(moved).toEqual({ kind: 'line', x1: 5, y1: -5, x2: 15, y2: 15 });
  });
  it('moves a polygon by its centre', () => {
    expect(translate({ kind: 'polygon', cx: 10, cy: 10, r: 4, sides: 5 }, 3, 3)).toEqual({
      kind: 'polygon',
      cx: 13,
      cy: 13,
      r: 4,
      sides: 5,
    });
  });
});

describe('fitToBox', () => {
  it('keeps a polygon regular by taking the smaller half-extent as its radius', () => {
    const poly = newObject('polygon', 1, 512);
    const fitted = fitToBox(poly, { x: 0, y: 0, w: 200, h: 80 });
    expect(fitted).toEqual({ kind: 'polygon', cx: 100, cy: 40, r: 40, sides: 6 });
  });

  it('keeps a line running the same way it did', () => {
    const line: IconObject = {
      ...newObject('line', 1, 512),
      geometry: { kind: 'line', x1: 100, y1: 200, x2: 0, y2: 0 },
      strokeWidth: 0,
    };
    // Ran right-to-left and bottom-to-top; must still do so in the new box.
    const fitted = fitToBox(line, { x: 10, y: 10, w: 100, h: 100 });
    expect(fitted).toEqual({ kind: 'line', x1: 110, y1: 110, x2: 10, y2: 10 });
  });

  it('round-trips: fitting a shape to its own bounds changes nothing', () => {
    for (const kind of ['rect', 'ellipse', 'line', 'polygon'] as const) {
      const object = newObject(kind, 1, 512);
      expect(fitToBox(object, bounds(object))).toEqual(object.geometry);
    }
  });

  it('never produces a negative size', () => {
    const fitted = fitToBox(rect(), { x: 0, y: 0, w: -50, h: -50 });
    expect(fitted).toMatchObject({ w: 0, h: 0 });
  });
});
