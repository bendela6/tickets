import { describe, expect, it } from 'vitest';
import {
  closesPath,
  handleEnds,
  penIsDrawable,
  penPreview,
  penSegments,
  type PenAnchor,
} from './pen';
import type { Point } from './types';

const corner = (x: number, y: number): PenAnchor => ({ point: { x, y }, handle: null });

const smooth = (x: number, y: number, handle: Point): PenAnchor => ({ point: { x, y }, handle });

describe('penSegments', () => {
  it('has nothing to say about no anchors', () => {
    expect(penSegments([], false)).toEqual([]);
    expect(penSegments([], true)).toEqual([]);
  });

  it('a single anchor is a move and nothing else — there is no run yet', () => {
    expect(penSegments([corner(10, 20)], false)).toEqual([{ c: 'M', x: 10, y: 20 }]);
  });

  it('corners are joined by straight commands', () => {
    expect(penSegments([corner(0, 0), corner(100, 0), corner(100, 100)], false)).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 100, y: 0 },
      { c: 'L', x: 100, y: 100 },
    ]);
  });

  it('a smooth anchor curves the commands either side of it, mirrored about it', () => {
    const segments = penSegments(
      [corner(0, 0), smooth(100, 100, { x: 20, y: 0 }), corner(200, 0)],
      false,
    );
    expect(segments).toEqual([
      { c: 'M', x: 0, y: 0 },
      // Arrives along the mirrored handle: 100 − 20.
      { c: 'C', x1: 0, y1: 0, x2: 80, y2: 100, x: 100, y: 100 },
      // Leaves along the handle itself: 100 + 20. The two controls, the anchor
      // and the tangent through it are one straight line, which is what makes
      // the curve continuous rather than kinked.
      { c: 'C', x1: 120, y1: 100, x2: 200, y2: 0, x: 200, y: 0 },
    ]);
  });

  it('a corner beside a smooth anchor is still a curve, with its control on itself', () => {
    const [, join] = penSegments([corner(0, 0), smooth(100, 0, { x: 10, y: 10 })], false);
    // The curve leaves the corner along nothing, which is a control sitting
    // exactly on it — not a straight command that would throw the handle away.
    expect(join).toEqual({ c: 'C', x1: 0, y1: 0, x2: 90, y2: -10, x: 100, y: 0 });
  });

  it('closing a run of corners needs no command in front of the Z', () => {
    // `Z` already draws the edge back to the point the subpath opened at, so
    // writing an `L` there would draw the same edge twice.
    expect(penSegments([corner(0, 0), corner(100, 0), corner(50, 90)], true)).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 100, y: 0 },
      { c: 'L', x: 50, y: 90 },
      { c: 'Z' },
    ]);
  });

  it('closing a curved run writes the closing edge out, because Z cannot steer', () => {
    const segments = penSegments(
      [smooth(0, 0, { x: 0, y: 20 }), corner(100, 0), corner(50, 90)],
      true,
    );
    expect(segments.at(-2)).toEqual({ c: 'C', x1: 50, y1: 90, x2: 0, y2: -20, x: 0, y: 0 });
    expect(segments.at(-1)).toEqual({ c: 'Z' });
  });
});

describe('handleEnds', () => {
  it('a corner has none', () => {
    expect(handleEnds(corner(10, 10))).toBeNull();
  });

  it('reaches the same distance either side of the anchor', () => {
    expect(handleEnds(smooth(100, 100, { x: 20, y: -10 }))).toEqual([
      { x: 80, y: 110 },
      { x: 120, y: 90 },
    ]);
  });
});

describe('penPreview', () => {
  it('has nothing to show before the first anchor', () => {
    expect(penPreview([], { x: 10, y: 10 })).toEqual([]);
  });

  it('shows the straight command a click would commit', () => {
    expect(penPreview([corner(0, 0)], { x: 50, y: 50 })).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 50, y: 50 },
    ]);
  });

  it('shows a curve when the anchor it leaves is a smooth one', () => {
    expect(penPreview([smooth(0, 0, { x: 30, y: 0 })], { x: 100, y: 0 })).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'C', x1: 30, y1: 0, x2: 100, y2: 0, x: 100, y: 0 },
    ]);
  });
});

describe('closesPath', () => {
  const anchors = [corner(0, 0), corner(100, 0), corner(100, 100)];

  it('is true within reach of the first anchor', () => {
    expect(closesPath(anchors, { x: 4, y: 3 }, 6)).toBe(true);
  });

  it('is false anywhere else, including on another anchor', () => {
    expect(closesPath(anchors, { x: 20, y: 0 }, 6)).toBe(false);
    expect(closesPath(anchors, { x: 100, y: 0 }, 6)).toBe(false);
  });

  it('refuses below two anchors, where closing would draw nothing at all', () => {
    expect(closesPath([corner(0, 0)], { x: 0, y: 0 }, 6)).toBe(false);
  });
});

describe('penIsDrawable', () => {
  it('takes two anchors, which is the least that draws anything', () => {
    expect(penIsDrawable([])).toBe(false);
    expect(penIsDrawable([corner(0, 0)])).toBe(false);
    expect(penIsDrawable([corner(0, 0), corner(1, 1)])).toBe(true);
  });
});
