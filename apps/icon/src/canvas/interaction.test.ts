import { describe, expect, it } from 'vitest';
import { boxCentre, rotatePoint } from '../doc/geometry';
import {
  anchorPoint,
  angleFrom,
  constrainDelta,
  handlePosition,
  handleDirection as handleDirectionForTest,
  lineEndpointAt,
  lineFromWorld,
  polygonResize,
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

const ALL_HANDLES = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'] as const;

/** Where a box handle actually sits on screen, once the object is rotated. */
const onScreen = (box: typeof start, handle: ResizeHandle, rotation: number) =>
  rotatePoint(handlePosition(box, handle), boxCentre(box), rotation);

describe('resizeRotated', () => {
  it('behaves exactly like an unrotated resize at 0°', () => {
    const pointer = { x: 400, y: 400 };
    expect(resizeRotated(start, 'se', pointer, 0, false)).toEqual(
      resizeBox(start, 'se', pointer, false),
    );
  });

  it('leaves the opposite handle exactly where it was, at every angle', () => {
    // The reported bug: dragging one handle dragged the whole shape, because
    // resizing moves the centre and everything else pivots about it.
    for (const rotation of [0, 17, 45, 90, 180, 271]) {
      for (const handle of ALL_HANDLES) {
        const before = onScreen(start, handle === 'se' ? 'nw' : anchorTwin(handle), rotation);
        const next = resizeRotated(start, handle, { x: 260, y: 90 }, rotation, false);
        const after = onScreen(next, handle === 'se' ? 'nw' : anchorTwin(handle), rotation);
        expect({ rotation, handle, x: after.x.toFixed(6), y: after.y.toFixed(6) }).toEqual({
          rotation,
          handle,
          x: before.x.toFixed(6),
          y: before.y.toFixed(6),
        });
      }
    }
  });

  it('puts a dragged corner exactly under the pointer, rotated or not', () => {
    for (const rotation of [0, 33, 120, 250]) {
      for (const handle of ['nw', 'ne', 'sw', 'se'] as const) {
        // A pointer genuinely on the handle's side of the anchor: push the
        // handle further out along the direction it already points.
        const at = handlePosition(start, handle);
        const sign = handleDirectionForTest(handle);
        const away = rotatePoint(
          { x: at.x + sign.x * 60, y: at.y + sign.y * 60 },
          boxCentre(start),
          rotation,
        );
        const landed = onScreen(resizeRotated(start, handle, away, rotation, false), handle, rotation);
        expect({ rotation, handle, x: landed.x.toFixed(6), y: landed.y.toFixed(6) }).toEqual({
          rotation,
          handle,
          x: away.x.toFixed(6),
          y: away.y.toFixed(6),
        });
      }
    }
  });

  it('an edge handle follows the pointer on its own axis and ignores the other', () => {
    // Dragging `e` sideways moves the east edge; wandering up and down while
    // you do it must not also change the height.
    const next = resizeRotated(start, 'e', { x: 420, y: 900 }, 0, false);
    expect(next.h).toBeCloseTo(start.h, 6);
    expect(next.x + next.w).toBeCloseTo(420, 6);
  });

  it('clamps rather than mirroring when dragged past the anchor', () => {
    // The handle cannot follow the pointer through the anchor and out the far
    // side — a box with negative width is not a smaller box, and springing
    // back to full size pointing the other way is worse than either.
    const past = resizeRotated(start, 'e', { x: -400, y: 150 }, 0, false);
    expect(past.w).toBeGreaterThan(0);
    expect(past.w).toBeLessThan(start.w);
    // The anchor — the west edge — is exactly where it was.
    expect(past.x).toBeCloseTo(start.x, 6);
  });

  it('a diagonal drag grows both sides fully, not by a normalised fraction', () => {
    // A corner's direction vector is 1/√2 per axis; multiplying a span by it
    // would take 30% off every diagonal resize.
    const next = resizeRotated(start, 'se', { x: 400, y: 300 }, 0, false);
    expect(next.w).toBeCloseTo(300, 6);
    expect(next.h).toBeCloseTo(200, 6);
  });

  it('an edge handle still changes one axis only', () => {
    const next = resizeRotated(start, 'e', { x: 500, y: 999 }, 40, false);
    expect(next.h).toBeCloseTo(start.h, 6);
  });

  it('grows along the object’s own axes rather than the artboard’s', () => {
    // At 90° the object's local +x runs down the screen, so a pointer dragged
    // straight DOWN from the SE handle should lengthen its width.
    const rotation = 90;
    const se = onScreen(start, 'se', rotation);
    const next = resizeRotated(start, 'se', { x: se.x, y: se.y + 60 }, rotation, false);
    expect(next.w).toBeCloseTo(start.w + 60, 4);
    expect(next.h).toBeCloseTo(start.h, 4);
  });

  it('still constrains the ratio under Shift when rotated', () => {
    const next = resizeRotated(start, 'se', { x: 500, y: 150 }, 25, true);
    expect(next.w / next.h).toBeCloseTo(start.w / start.h, 6);
  });

  it('never collapses to nothing', () => {
    const next = resizeRotated(start, 'se', anchorPoint(start, 'se'), 0, false);
    expect(next.w).toBeGreaterThan(0);
    expect(next.h).toBeGreaterThan(0);
  });
});

/** The handle diametrically opposite this one — the one that must not move. */
function anchorTwin(handle: ResizeHandle): ResizeHandle {
  const opposite: Record<ResizeHandle, ResizeHandle> = {
    nw: 'se',
    se: 'nw',
    ne: 'sw',
    sw: 'ne',
    n: 's',
    s: 'n',
    e: 'w',
    w: 'e',
  };
  return opposite[handle];
}

describe('polygonResize', () => {
  const poly = { cx: 100, cy: 100, r: 40 };

  /** Where a polygon's handle sits on screen. */
  const polyHandle = (shape: typeof poly, handle: ResizeHandle, rotation: number) => {
    const direction = handleDirectionForTest(handle);
    const isCorner = handle.length === 2;
    const reach = isCorner ? shape.r * Math.SQRT2 : shape.r;
    return rotatePoint(
      { x: shape.cx + direction.x * reach, y: shape.cy + direction.y * reach },
      { x: shape.cx, y: shape.cy },
      rotation,
    );
  };

  it('gives every handle something to do, including the horizontal ones', () => {
    // Fitting a polygon into a dragged rectangle took min(w,h)/2, which left
    // `e` inert on any polygon already wider than tall.
    for (const handle of ALL_HANDLES) {
      const next = polygonResize(poly, handle, { x: 200, y: 200 }, 0);
      expect({ handle, changed: next.r !== poly.r }).toEqual({ handle, changed: true });
    }
  });

  it('leaves the opposite handle exactly where it was, at every angle', () => {
    for (const rotation of [0, 23, 90, 200]) {
      for (const handle of ALL_HANDLES) {
        const before = polyHandle(poly, anchorTwin(handle), rotation);
        const next = polygonResize(poly, handle, { x: 190, y: 60 }, rotation);
        const after = polyHandle(next, anchorTwin(handle), rotation);
        expect({ rotation, handle, x: after.x.toFixed(6), y: after.y.toFixed(6) }).toEqual({
          rotation,
          handle,
          x: before.x.toFixed(6),
          y: before.y.toFixed(6),
        });
      }
    }
  });

  it('projects an off-axis wobble onto the handle’s own axis', () => {
    // Dragging `e` straight out, then wandering vertically, must not shrink it.
    const straight = polygonResize(poly, 'e', { x: 180, y: 100 }, 0);
    const wobbled = polygonResize(poly, 'e', { x: 180, y: 145 }, 0);
    expect(wobbled.r).toBeCloseTo(straight.r, 6);
  });

  it('grows from the anchor: dragging east doubles the reach across the shape', () => {
    // Anchor sits at x=60; pointer at x=200 means a 140 span, so r = 70.
    expect(polygonResize(poly, 'e', { x: 200, y: 100 }, 0)).toMatchObject({ r: 70, cx: 130 });
  });

  it('never collapses to nothing', () => {
    expect(polygonResize(poly, 'e', { x: -500, y: 100 }, 0).r).toBeGreaterThan(0);
  });
});

describe('lineFromWorld', () => {
  it('is the identity at 0°', () => {
    expect(lineFromWorld({ x: 10, y: 20 }, { x: 30, y: 40 }, 0)).toEqual({
      x1: 10,
      y1: 20,
      x2: 30,
      y2: 40,
    });
  });

  it('round-trips: rendering the result back out lands on the world points asked for', () => {
    const a = { x: 40, y: 90 };
    const b = { x: 300, y: 210 };
    for (const rotation of [0, 31, 90, 180, 305]) {
      const stored = lineFromWorld(a, b, rotation);
      // How the renderer draws it: rotate the stored ends about their midpoint.
      const pivot = { x: (stored.x1 + stored.x2) / 2, y: (stored.y1 + stored.y2) / 2 };
      const drawn1 = rotatePoint({ x: stored.x1, y: stored.y1 }, pivot, rotation);
      const drawn2 = rotatePoint({ x: stored.x2, y: stored.y2 }, pivot, rotation);
      expect({ rotation, x: drawn1.x.toFixed(6), y: drawn1.y.toFixed(6) }).toEqual({
        rotation,
        x: a.x.toFixed(6),
        y: a.y.toFixed(6),
      });
      expect({ rotation, x: drawn2.x.toFixed(6), y: drawn2.y.toFixed(6) }).toEqual({
        rotation,
        x: b.x.toFixed(6),
        y: b.y.toFixed(6),
      });
    }
  });

  it('preserves length whatever the rotation', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 120, y: 50 };
    const expected = Math.hypot(120, 50);
    for (const rotation of [0, 45, 137]) {
      const s = lineFromWorld(a, b, rotation);
      expect(Math.hypot(s.x2 - s.x1, s.y2 - s.y1)).toBeCloseTo(expected, 6);
    }
  });

  it('moving one end leaves the other exactly where it was on screen', () => {
    // The reported bug, stated directly.
    const rotation = 40;
    const fixedEnd = { x: 300, y: 210 };
    const first = lineFromWorld({ x: 40, y: 90 }, fixedEnd, rotation);
    const second = lineFromWorld({ x: 155, y: 12 }, fixedEnd, rotation);

    const drawnFar = (s: typeof first) => {
      const pivot = { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
      return rotatePoint({ x: s.x2, y: s.y2 }, pivot, rotation);
    };
    const before = drawnFar(first);
    const after = drawnFar(second);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
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
