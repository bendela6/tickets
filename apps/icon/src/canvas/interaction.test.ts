import { describe, expect, it } from 'vitest';
import {
  boxCentre,
  flattenPath,
  pointsBox,
  rotatePoint,
  type Point,
} from '../doc/geometry';
import type { PathSegment } from '../doc/types';
import {
  anchorPoint,
  angleFrom,
  circleResize,
  constrainDelta,
  controlHandle,
  controlParts,
  handleCursor,
  handlePosition,
  handleDirection as handleDirectionForTest,
  isControl,
  isVertex,
  movePathAnchor,
  movePathControl,
  pointsFromWorld,
  resizeBox,
  resizeRotated,
  snapAngle,
  vertexAnchor,
  vertexAt,
  vertexHandle,
  vertexIndex,
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

describe('circleResize', () => {
  const circle = { cx: 100, cy: 100, r: 40 };

  /** Where a circle's handle sits on screen. */
  const circleHandle = (shape: typeof circle, handle: ResizeHandle, rotation: number) => {
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
    // Fitting a round shape into a dragged rectangle took min(w,h)/2, which
    // left `e` inert on anything already wider than tall.
    for (const handle of ALL_HANDLES) {
      const next = circleResize(circle, handle, { x: 200, y: 200 }, 0);
      expect({ handle, changed: next.r !== circle.r }).toEqual({ handle, changed: true });
    }
  });

  it('leaves the opposite handle exactly where it was, at every angle', () => {
    for (const rotation of [0, 23, 90, 200]) {
      for (const handle of ALL_HANDLES) {
        const before = circleHandle(circle, anchorTwin(handle), rotation);
        const next = circleResize(circle, handle, { x: 190, y: 60 }, rotation);
        const after = circleHandle(next, anchorTwin(handle), rotation);
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
    const straight = circleResize(circle, 'e', { x: 180, y: 100 }, 0);
    const wobbled = circleResize(circle, 'e', { x: 180, y: 145 }, 0);
    expect(wobbled.r).toBeCloseTo(straight.r, 6);
  });

  it('grows from the anchor: dragging east doubles the reach across the shape', () => {
    // Anchor sits at x=60; pointer at x=200 means a 140 span, so r = 70.
    expect(circleResize(circle, 'e', { x: 200, y: 100 }, 0)).toMatchObject({ r: 70, cx: 130 });
  });

  it('never collapses to nothing', () => {
    expect(circleResize(circle, 'e', { x: -500, y: 100 }, 0).r).toBeGreaterThan(0);
  });
});

describe('vertex handles', () => {
  it('name a point by its place in the list, and read back the same number', () => {
    expect(vertexHandle(0)).toBe('v0');
    expect(vertexIndex(vertexHandle(12))).toBe(12);
  });

  it('are told apart from the box handles, which share the same union', () => {
    expect(isVertex('v3')).toBe(true);
    expect(isVertex('nw')).toBe(false);
    expect(isVertex('rotate')).toBe(false);
  });

  it('all wear the move cursor, whatever their index', () => {
    expect(handleCursor('v0')).toBe('move');
    expect(handleCursor('v99')).toBe('move');
    expect(handleCursor('nw')).toBe('nwse-resize');
    expect(handleCursor('rotate')).toBe('grab');
  });
});

describe('control handles', () => {
  it('name a command and which of its two controls, and read both back', () => {
    expect(controlHandle(7, 2)).toBe('c7-2');
    expect(controlParts(controlHandle(7, 2))).toEqual({ segment: 7, which: 2 });
    expect(controlParts(controlHandle(0, 1))).toEqual({ segment: 0, which: 1 });
  });

  it('are told apart from vertices, which they sit beside and are not', () => {
    expect(isControl('c3-1')).toBe(true);
    expect(isControl('v3')).toBe(false);
    expect(isVertex('c3-1')).toBe(false);
    expect(isControl('rotate')).toBe(false);
  });

  it('wear the move cursor too', () => {
    expect(handleCursor('c2-2')).toBe('move');
  });
});

/** Two cubics meeting at (100,0), so the middle anchor has a handle either side. */
const BOW: PathSegment[] = [
  { c: 'M', x: 0, y: 0 },
  { c: 'C', x1: 20, y1: -60, x2: 80, y2: -60, x: 100, y: 0 },
  { c: 'C', x1: 120, y1: 60, x2: 180, y2: 60, x: 200, y: 0 },
];

/**
 * Every stored coordinate of a path, drawn where the renderer would put it: the
 * SVG turns the whole path about the centre of its flattened box, which is what
 * `centreOf` reports and what moving any single coordinate disturbs.
 */
const drawnPath = (segments: readonly PathSegment[], rotation: number): Point[] => {
  const pivot = boxCentre(pointsBox(flattenPath(segments).flat()));
  const points: Point[] = [];
  for (const segment of segments) {
    if (segment.c === 'Z') continue;
    if (segment.c === 'C' || segment.c === 'Q') {
      points.push(rotatePoint({ x: segment.x1, y: segment.y1 }, pivot, rotation));
    }
    if (segment.c === 'C') {
      points.push(rotatePoint({ x: segment.x2, y: segment.y2 }, pivot, rotation));
    }
    points.push(rotatePoint({ x: segment.x, y: segment.y }, pivot, rotation));
  }
  return points;
};

const at = (points: readonly Point[], index: number): Point =>
  points[index] ?? { x: Number.NaN, y: Number.NaN };

/**
 * A coordinate as a comparable string. `+ 0` folds negative zero onto zero:
 * a value that rounds to nothing can still carry the sign of the float it came
 * from, and `-0.000000000` is not a position different from `0.000000000`.
 */
const fixed = (value: number): string => (Number(value.toFixed(9)) + 0).toFixed(9);

/** Where a point sits, as one string, so a failure names both axes at once. */
const place = (point: Point): string => `${fixed(point.x)},${fixed(point.y)}`;

describe('movePathAnchor', () => {
  it('carries the handles either side of the node by the same delta', () => {
    // Without this the node moves while the points steering the curve there
    // stay put, and the outline swings away from the handle you are holding.
    const moved = movePathAnchor(BOW, 1, { x: 30, y: -20 }, 0);
    expect(moved[1]).toEqual({ c: 'C', x1: 20, y1: -60, x2: 110, y2: -80, x: 130, y: -20 });
    expect(moved[2]).toEqual({ c: 'C', x1: 150, y1: 40, x2: 180, y2: 60, x: 200, y: 0 });
    // The far ends of the two curves are not this node's business.
    expect(moved[0]).toEqual(BOW[0]);
  });

  it('moves one node of a ROTATED path and leaves every other point exactly on screen', () => {
    // The property that matters: a path turns about the centre of its own box,
    // and moving any point in it moves that centre — so everything else swings
    // unless the whole path is slid back by exactly what the pivot drifted.
    for (const rotation of [0, 37, 90, 180, 213]) {
      const before = drawnPath(BOW, rotation);
      const after = drawnPath(movePathAnchor(BOW, 1, { x: 30, y: -20 }, rotation), rotation);
      // BOW draws six coordinates; the node is the fourth and its two handles
      // the third and fifth, so indices 0, 1 and 5 must not have moved at all.
      for (const index of [0, 1, 5]) {
        expect({ rotation, index, at: place(at(after, index)) }).toEqual({
          rotation,
          index,
          at: place(at(before, index)),
        });
      }
    }
  });

  it('puts the dragged node exactly under the pointer, at every angle', () => {
    for (const rotation of [0, 37, 90, 213]) {
      const before = drawnPath(BOW, rotation);
      const after = drawnPath(movePathAnchor(BOW, 1, { x: 30, y: -20 }, rotation), rotation);
      expect({ rotation, at: place(at(after, 3)) }).toEqual({
        rotation,
        at: place({ x: at(before, 3).x + 30, y: at(before, 3).y - 20 }),
      });
    }
  });

  it('drags an arc’s endpoint without touching its radii, which are lengths', () => {
    const semi: PathSegment[] = [
      { c: 'M', x: 0, y: 0 },
      { c: 'A', rx: 10, ry: 10, rotation: 0, large: false, sweep: true, x: 20, y: 0 },
    ];
    expect(movePathAnchor(semi, 1, { x: 5, y: 5 }, 0)[1]).toEqual({
      c: 'A',
      rx: 10,
      ry: 10,
      rotation: 0,
      large: false,
      sweep: true,
      x: 25,
      y: 5,
    });
  });

  it('has nothing to move for a node that is not there, and says so by changing nothing', () => {
    expect(movePathAnchor(BOW, 9, { x: 10, y: 10 }, 0)).toEqual(BOW);
  });
});

describe('movePathControl', () => {
  it('moves that control and nothing else', () => {
    const moved = movePathControl(BOW, 1, 2, { x: 15, y: 25 }, 0);
    expect(moved[1]).toEqual({ c: 'C', x1: 20, y1: -60, x2: 95, y2: -35, x: 100, y: 0 });
    expect(moved[0]).toEqual(BOW[0]);
    expect(moved[2]).toEqual(BOW[2]);
  });

  it('leaves every node and every other control exactly on screen when rotated', () => {
    // A control point steers the curve between two nodes; dragging one must not
    // shift either of them, and the drifting pivot is what would.
    for (const rotation of [0, 37, 90, 213]) {
      const before = drawnPath(BOW, rotation);
      const after = drawnPath(movePathControl(BOW, 1, 2, { x: 15, y: 25 }, rotation), rotation);
      for (const index of [0, 1, 3, 4, 5]) {
        expect({ rotation, index, at: place(at(after, index)) }).toEqual({
          rotation,
          index,
          at: place(at(before, index)),
        });
      }
      // And the one that was dragged lands exactly where it was asked to.
      expect({ rotation, at: place(at(after, 2)) }).toEqual({
        rotation,
        at: place({ x: at(before, 2).x + 15, y: at(before, 2).y + 25 }),
      });
    }
  });

  it('leaves a command that has no such control alone', () => {
    const straight: PathSegment[] = [
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 10, y: 0 },
    ];
    expect(movePathControl(straight, 1, 1, { x: 5, y: 5 }, 0)).toEqual(straight);
  });
});

describe('vertexAnchor', () => {
  const run: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 10 },
  ];

  it('is the previous point, which is where the dragged one leaves from', () => {
    expect(vertexAnchor(run, 2)).toEqual({ x: 10, y: 0 });
  });

  it('falls forward for the first point, which has nothing before it', () => {
    expect(vertexAnchor(run, 0)).toEqual({ x: 10, y: 0 });
  });

  it('is the far end on a line, so Shift means there what it always did', () => {
    const line: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
    ];
    expect(vertexAnchor(line, 0)).toEqual({ x: 50, y: 50 });
    expect(vertexAnchor(line, 1)).toEqual({ x: 0, y: 0 });
  });

  it('has nothing to offer a single point, rather than pointing at itself', () => {
    expect(vertexAnchor([{ x: 1, y: 2 }], 0)).toBeNull();
  });
});

/** How the renderer draws stored points: turned about the centre of their box. */
const drawn = (stored: readonly Point[], rotation: number): Point[] => {
  const xs = stored.map((point) => point.x);
  const ys = stored.map((point) => point.y);
  const pivot = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
  return stored.map((point) => rotatePoint(point, pivot, rotation));
};

describe('pointsFromWorld', () => {
  const triangle: Point[] = [
    { x: 40, y: 90 },
    { x: 300, y: 210 },
    { x: 120, y: 260 },
  ];

  it('is the identity at 0°', () => {
    expect(pointsFromWorld(triangle, 0)).toEqual(triangle);
  });

  it('round-trips: drawing the result back out lands on the world points asked for', () => {
    for (const rotation of [0, 31, 90, 180, 305]) {
      for (const points of [triangle, triangle.slice(0, 2)]) {
        const redrawn = drawn(pointsFromWorld(points, rotation), rotation);
        expect({ rotation, at: redrawn.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`) }).toEqual({
          rotation,
          at: points.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`),
        });
      }
    }
  });

  it('preserves every distance, because a rotation is all it applies', () => {
    for (const rotation of [0, 45, 137]) {
      const stored = pointsFromWorld(triangle, rotation);
      for (let i = 1; i < triangle.length; i++) {
        const before = Math.hypot(
          (triangle[i]?.x ?? 0) - (triangle[i - 1]?.x ?? 0),
          (triangle[i]?.y ?? 0) - (triangle[i - 1]?.y ?? 0),
        );
        const after = Math.hypot(
          (stored[i]?.x ?? 0) - (stored[i - 1]?.x ?? 0),
          (stored[i]?.y ?? 0) - (stored[i - 1]?.y ?? 0),
        );
        expect(after).toBeCloseTo(before, 6);
      }
    }
  });

  it('moving one point leaves every other exactly where it was on screen', () => {
    // The reported bug, stated directly: the pivot is the centre of the
    // points' own box, and moving one point moves that box.
    const rotation = 40;
    const before = drawn(pointsFromWorld(triangle, rotation), rotation);
    const moved = [{ x: 155, y: 12 }, ...triangle.slice(1)];
    const after = drawn(pointsFromWorld(moved, rotation), rotation);
    for (let i = 1; i < triangle.length; i++) {
      expect(after[i]?.x).toBeCloseTo(before[i]?.x ?? Number.NaN, 6);
      expect(after[i]?.y).toBeCloseTo(before[i]?.y ?? Number.NaN, 6);
    }
  });

  it('has nothing to place when there are no points', () => {
    expect(pointsFromWorld([], 45)).toEqual([]);
  });
});

describe('vertexAt', () => {
  const anchor = { x: 0, y: 0 };

  it('follows the pointer exactly when free', () => {
    expect(vertexAt(anchor, { x: 37, y: -11 }, false)).toEqual({ x: 37, y: -11 });
  });

  it('snaps the segment’s angle rather than locking an axis', () => {
    // 40° from horizontal, length 100 — Shift should land it on 45°.
    const pointer = { x: 100 * Math.cos(0.698), y: 100 * Math.sin(0.698) };
    const snapped = vertexAt(anchor, pointer, true);
    expect(Math.hypot(snapped.x, snapped.y)).toBeCloseTo(100, 6);
    expect((Math.atan2(snapped.y, snapped.x) * 180) / Math.PI).toBeCloseTo(45, 6);
  });

  it('keeps the length while snapping, so Shift turns the segment and does not stretch it', () => {
    const pointer = { x: 60, y: 25 };
    const before = Math.hypot(pointer.x, pointer.y);
    const snapped = vertexAt(anchor, pointer, true);
    expect(Math.hypot(snapped.x, snapped.y)).toBeCloseTo(before, 6);
  });

  it('reaches both axes and both diagonals from its 15° steps', () => {
    const at = (degrees: number) => {
      const radians = (degrees * Math.PI) / 180;
      const snapped = vertexAt(anchor, { x: Math.cos(radians), y: Math.sin(radians) }, true);
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
