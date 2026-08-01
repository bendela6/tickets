import { describe, expect, it } from 'vitest';
import { MIN_GRID_PX } from './constants';
import { gridPitch, snapGeometry, snapTo } from './snap';

describe('snapTo', () => {
  it('a step of 1 allows whole units and nothing between them', () => {
    expect(snapTo(1.5, 1)).toBe(2);
    expect(snapTo(1.4, 1)).toBe(1);
    expect(snapTo(2.5, 1)).toBe(3);
  });

  it('a coarser step lands on its own multiples', () => {
    expect(snapTo(13, 8)).toBe(16);
    expect(snapTo(11, 8)).toBe(8);
    expect(snapTo(100, 16)).toBe(96);
  });

  it('a finer step allows what a coarser one would not', () => {
    expect(snapTo(1.5, 0.5)).toBe(1.5);
    expect(snapTo(1.3, 0.5)).toBe(1.5);
    expect(snapTo(1.1, 0.25)).toBe(1);
  });

  it('keeps fractional steps clean rather than accumulating float error', () => {
    // 0.1 * 3 is 0.30000000000000004 in binary floating point, and that would
    // end up in a saved document and an exported file.
    expect(snapTo(0.3, 0.1)).toBe(0.3);
    expect(String(snapTo(0.7, 0.1))).toBe('0.7');
  });

  it('handles negatives symmetrically', () => {
    expect(snapTo(-1.5, 1)).toBe(-1);
    expect(snapTo(-13, 8)).toBe(-16);
  });

  it('passes the value straight through when there is effectively no grid', () => {
    expect(snapTo(1.234, 0)).toBe(1.234);
    expect(snapTo(1.234, Number.NaN)).toBe(1.234);
  });
});

describe('snapGeometry', () => {
  it('snaps every measurement of a rect', () => {
    expect(
      snapGeometry({ kind: 'rect', x: 1.4, y: 2.6, w: 9.9, h: 4.2, radius: 1.6 }, 1),
    ).toEqual({ kind: 'rect', x: 1, y: 3, w: 10, h: 4, radius: 2 });
  });

  it('never lets a snapped radius bulge past the box it rounds', () => {
    const snapped = snapGeometry({ kind: 'rect', x: 0, y: 0, w: 4, h: 4, radius: 7 }, 1);
    expect(snapped).toMatchObject({ radius: 2 });
  });

  it('snaps both ends of a line', () => {
    expect(snapGeometry({ kind: 'line', x1: 0.4, y1: 9.7, x2: 20.2, y2: 3.5 }, 1)).toEqual({
      kind: 'line',
      x1: 0,
      y1: 10,
      x2: 20,
      y2: 4,
    });
  });

  it('snaps a circle’s centre and its radius', () => {
    expect(snapGeometry({ kind: 'circle', cx: 9.6, cy: 9.6, r: 5.4 }, 8)).toEqual({
      kind: 'circle',
      cx: 8,
      cy: 8,
      r: 8,
    });
  });

  it('snaps every point of a run, so no vertex lands between grid lines', () => {
    const snapped = snapGeometry(
      {
        kind: 'polygon',
        points: [
          { x: 0.4, y: 9.7 },
          { x: 20.2, y: 3.5 },
          { x: 5.5, y: 15.1 },
        ],
      },
      1,
    );
    expect(snapped).toEqual({
      kind: 'polygon',
      points: [
        { x: 0, y: 10 },
        { x: 20, y: 4 },
        { x: 6, y: 15 },
      ],
    });
  });

  it('snaps a polyline the same way, since a run is a run', () => {
    expect(snapGeometry({ kind: 'polyline', points: [{ x: 1.4, y: 2.6 }] }, 1)).toEqual({
      kind: 'polyline',
      points: [{ x: 1, y: 3 }],
    });
  });

  it('snaps the points a path is drawn through and leaves its controls and radii alone', () => {
    // A control point is never drawn, so putting one on the grid puts nothing
    // on the grid and moves the curve for no reason anybody can see.
    expect(
      snapGeometry(
        {
          kind: 'path',
          segments: [
            { c: 'M', x: 1.4, y: 2.6 },
            { c: 'C', x1: 3.4, y1: 4.6, x2: 5.4, y2: 6.6, x: 7.4, y: 8.6 },
            { c: 'A', rx: 9.4, ry: 10.6, rotation: 12.4, large: true, sweep: false, x: 11.4, y: 12.6 },
            { c: 'Z' },
          ],
        },
        1,
      ),
    ).toEqual({
      kind: 'path',
      segments: [
        { c: 'M', x: 1, y: 3 },
        { c: 'C', x1: 3.4, y1: 4.6, x2: 5.4, y2: 6.6, x: 7, y: 9 },
        { c: 'A', rx: 9.4, ry: 10.6, rotation: 12.4, large: true, sweep: false, x: 11, y: 13 },
        { c: 'Z' },
      ],
    });
  });
});

describe('gridPitch', () => {
  it('draws the snap step itself when there is room for it', () => {
    // A step of 1 at 28 pixels per unit is plainly readable.
    expect(gridPitch(1, 28, MIN_GRID_PX)).toBe(1);
  });

  it('doubles until the lines are far enough apart to read', () => {
    // At 1 pixel per unit a step of 1 would be solid grey.
    expect(gridPitch(1, 1, MIN_GRID_PX)).toBe(8);
    expect(gridPitch(0.5, 1, MIN_GRID_PX)).toBe(8);
  });

  it('gives up rather than drawing a grid nobody can use', () => {
    expect(gridPitch(1, 0.0000001, MIN_GRID_PX)).toBeNull();
  });

  it('has nothing to draw without a step or a scale', () => {
    expect(gridPitch(0, 10, MIN_GRID_PX)).toBeNull();
    expect(gridPitch(1, 0, MIN_GRID_PX)).toBeNull();
  });
});
