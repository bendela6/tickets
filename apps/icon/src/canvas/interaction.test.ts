import { describe, expect, it } from 'vitest';
import { boxCentre, rotatePoint } from '../doc/geometry';
import {
  anchorPoint,
  angleFrom,
  constrainDelta,
  handlePosition,
  lineEndpointAt,
  polygonRadius,
  resizeBox,
  resizeRotated,
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

describe('anchorPoint', () => {
  it('is the opposite corner for a corner, the opposite edge for an edge', () => {
    expect(anchorPoint(start, 'se')).toEqual({ x: 100, y: 100 });
    expect(anchorPoint(start, 'nw')).toEqual({ x: 300, y: 200 });
    expect(anchorPoint(start, 'e')).toEqual({ x: 100, y: 150 });
    expect(anchorPoint(start, 'n')).toEqual({ x: 200, y: 200 });
  });
});

describe('resizeRotated', () => {
  it('behaves exactly like an unrotated resize at 0°', () => {
    const pointer = { x: 400, y: 400 };
    expect(resizeRotated(start, 'se', pointer, 0, false)).toEqual(
      resizeBox(start, 'se', pointer, false),
    );
  });

  it('keeps the anchor corner still on screen, which is the whole point', () => {
    const rotation = 30;
    const centre = boxCentre(start);
    const anchorBefore = rotatePoint(anchorPoint(start, 'se'), centre, rotation);

    // Drag the SE handle somewhere arbitrary in artboard space.
    const next = resizeRotated(start, 'se', { x: 380, y: 340 }, rotation, false);
    const anchorAfter = rotatePoint(anchorPoint(next, 'se'), boxCentre(next), rotation);

    expect(anchorAfter.x).toBeCloseTo(anchorBefore.x, 6);
    expect(anchorAfter.y).toBeCloseTo(anchorBefore.y, 6);
  });

  it('holds the anchor for every handle, not only the corners', () => {
    const rotation = 47;
    for (const handle of ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as const) {
      const centre = boxCentre(start);
      const before = rotatePoint(anchorPoint(start, handle), centre, rotation);
      const next = resizeRotated(start, handle, { x: 260, y: 90 }, rotation, false);
      const after = rotatePoint(anchorPoint(next, handle), boxCentre(next), rotation);
      expect({ handle, x: after.x.toFixed(4), y: after.y.toFixed(4) }).toEqual({
        handle,
        x: before.x.toFixed(4),
        y: before.y.toFixed(4),
      });
    }
  });

  it('grows along the object’s own axes rather than the artboard’s', () => {
    // At 90° the object's local +x runs down the screen, so a pointer dragged
    // straight DOWN from the SE handle should lengthen its width.
    const rotation = 90;
    const centre = boxCentre(start);
    const seOnScreen = rotatePoint(handlePosition(start, 'se'), centre, rotation);
    const next = resizeRotated(
      start,
      'se',
      { x: seOnScreen.x, y: seOnScreen.y + 60 },
      rotation,
      false,
    );
    expect(next.w).toBeCloseTo(start.w + 60, 4);
    expect(next.h).toBeCloseTo(start.h, 4);
  });

  it('still constrains the ratio under Shift when rotated', () => {
    const next = resizeRotated(start, 'se', { x: 500, y: 150 }, 25, true);
    expect(next.w / next.h).toBeCloseTo(start.w / start.h, 6);
  });
});

describe('polygonRadius', () => {
  const centre = { x: 100, y: 100 };

  it('gives every handle something to do, including the horizontal ones', () => {
    // The old box-fitting took min(w,h)/2, which left `e` inert on any polygon
    // whose box was already wider than tall.
    expect(polygonRadius(centre, 'e', { x: 180, y: 100 }, 0)).toBe(80);
    expect(polygonRadius(centre, 'w', { x: 30, y: 100 }, 0)).toBe(70);
    expect(polygonRadius(centre, 'n', { x: 100, y: 40 }, 0)).toBe(60);
    expect(polygonRadius(centre, 's', { x: 100, y: 190 }, 0)).toBe(90);
  });

  it('a corner takes the larger of the two axes, so a diagonal drag grows it', () => {
    expect(polygonRadius(centre, 'se', { x: 150, y: 190 }, 0)).toBe(90);
  });

  it('measures in the object’s own frame when it is rotated', () => {
    // At 90° a pointer straight below the centre is on the local +x axis.
    expect(polygonRadius(centre, 'e', { x: 100, y: 180 }, 90)).toBeCloseTo(80, 6);
  });

  it('never collapses to nothing', () => {
    expect(polygonRadius(centre, 'e', centre, 0)).toBeGreaterThan(0);
  });
});

describe('lineEndpointAt', () => {
  const anchor = { x: 0, y: 0 };

  it('follows the pointer exactly when free', () => {
    expect(lineEndpointAt(anchor, { x: 37, y: -11 }, false)).toEqual({ x: 37, y: -11 });
  });

  it('snaps the segment’s angle rather than locking an axis', () => {
    // 40° from horizontal, length 100 — Shift should land it on 45°.
    const pointer = { x: 100 * Math.cos(0.698), y: 100 * Math.sin(0.698) };
    const snapped = lineEndpointAt(anchor, pointer, true);
    expect(Math.hypot(snapped.x, snapped.y)).toBeCloseTo(100, 6);
    expect((Math.atan2(snapped.y, snapped.x) * 180) / Math.PI).toBeCloseTo(45, 6);
  });

  it('keeps the length while snapping, so Shift turns the line and does not stretch it', () => {
    const pointer = { x: 60, y: 25 };
    const before = Math.hypot(pointer.x, pointer.y);
    const snapped = lineEndpointAt(anchor, pointer, true);
    expect(Math.hypot(snapped.x, snapped.y)).toBeCloseTo(before, 6);
  });

  it('reaches both axes and both diagonals from its 15° steps', () => {
    const at = (degrees: number) => {
      const radians = (degrees * Math.PI) / 180;
      const snapped = lineEndpointAt(anchor, { x: Math.cos(radians), y: Math.sin(radians) }, true);
      return Math.round((Math.atan2(snapped.y, snapped.x) * 180) / Math.PI);
    };
    expect(at(2)).toBe(0);
    expect(at(46)).toBe(45);
    expect(at(88)).toBe(90);
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
