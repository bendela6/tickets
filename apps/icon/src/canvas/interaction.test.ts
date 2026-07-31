import { describe, expect, it } from 'vitest';
import {
  angleFrom,
  constrainDelta,
  handlePosition,
  resizeBox,
  snapAngle,
  type ResizeHandle,
} from './interaction';

const start = { x: 100, y: 100, w: 200, h: 100 };

describe('resizeBox', () => {
  it('moves only the edges the handle owns', () => {
    const se = resizeBox(start, 'se', { x: 400, y: 400 }, false);
    expect(se).toEqual({ x: 100, y: 100, w: 300, h: 300 });
    const nw = resizeBox(start, 'nw', { x: 50, y: 50 }, false);
    expect(nw).toEqual({ x: 50, y: 50, w: 250, h: 150 });
  });

  it('an edge handle moves one axis and leaves the other exactly as it was', () => {
    expect(resizeBox(start, 'e', { x: 500, y: 999 }, false)).toEqual({
      x: 100,
      y: 100,
      w: 400,
      h: 100,
    });
    expect(resizeBox(start, 'n', { x: 999, y: 20 }, false)).toEqual({
      x: 100,
      y: 20,
      w: 200,
      h: 180,
    });
  });

  it('will not invert the box when dragged past the opposite edge', () => {
    const flipped = resizeBox(start, 'e', { x: -500, y: 0 }, false);
    expect(flipped.w).toBeGreaterThan(0);
    expect(flipped.x).toBe(100);
  });

  it('Shift on a corner preserves the starting ratio', () => {
    const constrained = resizeBox(start, 'se', { x: 500, y: 150 }, true);
    expect(constrained.w / constrained.h).toBeCloseTo(start.w / start.h);
  });

  it('Shift keeps the anchor corner still while the ratio is enforced', () => {
    // Dragging nw: the SE corner is the anchor and must not move.
    const constrained = resizeBox(start, 'nw', { x: 0, y: 90 }, true);
    expect(constrained.x + constrained.w).toBeCloseTo(start.x + start.w);
    expect(constrained.y + constrained.h).toBeCloseTo(start.y + start.h);
  });

  it('Shift does nothing on an edge handle, which already moves one axis', () => {
    const handle: ResizeHandle = 'e';
    expect(resizeBox(start, handle, { x: 500, y: 0 }, true)).toEqual(
      resizeBox(start, handle, { x: 500, y: 0 }, false),
    );
  });

  it('survives a zero-sized starting box rather than dividing by zero', () => {
    const flat = { x: 0, y: 0, w: 0, h: 0 };
    const resized = resizeBox(flat, 'se', { x: 50, y: 50 }, true);
    expect(Number.isFinite(resized.w)).toBe(true);
    expect(Number.isFinite(resized.h)).toBe(true);
  });
});

describe('handlePosition', () => {
  it('places corners, edges and midpoints where the box has them', () => {
    expect(handlePosition(start, 'nw')).toEqual({ x: 100, y: 100 });
    expect(handlePosition(start, 'se')).toEqual({ x: 300, y: 200 });
    expect(handlePosition(start, 'n')).toEqual({ x: 200, y: 100 });
    expect(handlePosition(start, 'w')).toEqual({ x: 100, y: 150 });
  });
});

describe('angleFrom', () => {
  it('reads zero straight up and increases clockwise', () => {
    const centre = { x: 0, y: 0 };
    expect(angleFrom(centre, { x: 0, y: -10 })).toBeCloseTo(0);
    expect(angleFrom(centre, { x: 10, y: 0 })).toBeCloseTo(90);
    expect(angleFrom(centre, { x: 0, y: 10 })).toBeCloseTo(180);
    expect(angleFrom(centre, { x: -10, y: 0 })).toBeCloseTo(270);
  });
});

describe('snapAngle', () => {
  it('rounds to whole degrees when free', () => {
    expect(snapAngle(41.6, false)).toBe(42);
  });
  it('lands on 15° steps under Shift', () => {
    expect(snapAngle(41.6, true)).toBe(45);
    expect(snapAngle(7, true)).toBe(0);
    expect(snapAngle(358, true)).toBe(0);
  });
  it('normalises negatives into 0–359', () => {
    expect(snapAngle(-90, false)).toBe(270);
  });
});

describe('constrainDelta', () => {
  it('passes a free drag straight through', () => {
    expect(constrainDelta(7, -3, false)).toEqual({ x: 7, y: -3 });
  });
  it('locks to whichever axis has moved further, so a turning drag follows', () => {
    expect(constrainDelta(20, 5, true)).toEqual({ x: 20, y: 0 });
    expect(constrainDelta(5, -20, true)).toEqual({ x: 0, y: -20 });
  });
  it('breaks an exact tie towards horizontal rather than jittering', () => {
    expect(constrainDelta(10, -10, true)).toEqual({ x: 10, y: 0 });
  });
});
