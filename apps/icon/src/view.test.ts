import { describe, expect, it } from 'vitest';
import { ARTBOARD_PX, ZOOM_MAX, ZOOM_MIN } from './doc/constants';
import { clampZoom, scaleFor, steppedZoom, zoomToFit } from './view';

describe('steppedZoom', () => {
  it('walks the ladder rather than adding a fixed percentage', () => {
    // 25 percentage points means something quite different at 25% than at
    // 1600%, which is why the range is a ladder.
    expect(steppedZoom(100, 1)).toBe(150);
    expect(steppedZoom(100, -1)).toBe(75);
    expect(steppedZoom(800, 1)).toBe(1600);
  });

  it('finds the next rung from a value that is not on the ladder', () => {
    expect(steppedZoom(120, 1)).toBe(150);
    expect(steppedZoom(120, -1)).toBe(100);
  });

  it('stops at the ends instead of running off them', () => {
    expect(steppedZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
    expect(steppedZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
  });
});

describe('clampZoom', () => {
  it('holds the range', () => {
    expect(clampZoom(-40)).toBe(ZOOM_MIN);
    expect(clampZoom(99999)).toBe(ZOOM_MAX);
    expect(clampZoom(137)).toBe(137);
  });
});

describe('scaleFor', () => {
  it('puts the longer edge at the artboard width when zoomed to 100%', () => {
    expect(scaleFor({ width: 512, height: 512 }, 100) * 512).toBeCloseTo(ARTBOARD_PX, 6);
    expect(scaleFor({ width: 1024, height: 512 }, 100) * 1024).toBeCloseTo(ARTBOARD_PX, 6);
  });

  it('gives both axes the same scale, so a wide board stays wide', () => {
    const scale = scaleFor({ width: 1024, height: 256 }, 100);
    expect(1024 * scale).toBeCloseTo(ARTBOARD_PX, 6);
    expect(256 * scale).toBeCloseTo(ARTBOARD_PX / 4, 6);
  });

  it('magnifies a tiny board enough to draw on', () => {
    // A 16-unit board at 100% is 28 screen pixels per unit — the point of
    // sizing by the longer edge rather than by the unit count.
    expect(scaleFor({ width: 16, height: 16 }, 100)).toBeCloseTo(ARTBOARD_PX / 16, 6);
  });

  it('scales linearly with zoom', () => {
    const board = { width: 512, height: 512 };
    expect(scaleFor(board, 200)).toBeCloseTo(scaleFor(board, 100) * 2, 9);
  });

  it('survives a degenerate board rather than dividing by zero', () => {
    expect(Number.isFinite(scaleFor({ width: 0, height: 0 }, 100))).toBe(true);
  });
});

describe('zoomToFit', () => {
  it('shrinks a board that is bigger than the viewport', () => {
    expect(zoomToFit({ width: 512, height: 512 }, { width: 300, height: 300 })).toBeLessThan(100);
  });

  it('grows a board that is smaller than the viewport', () => {
    expect(zoomToFit({ width: 16, height: 16 }, { width: 1200, height: 900 })).toBeGreaterThan(100);
  });

  it('stays inside the zoom range', () => {
    const tiny = zoomToFit({ width: 4096, height: 4096 }, { width: 10, height: 10 });
    expect(tiny).toBeGreaterThanOrEqual(ZOOM_MIN);
    expect(tiny).toBeLessThanOrEqual(ZOOM_MAX);
  });

  it('fills the room a wide board actually has, rather than the shorter edge', () => {
    // A 1024×256 board in a 1000×400 room is limited by width, not height:
    // taking the smaller viewport edge would have fitted it to 400px and left
    // it at a quarter of the zoom it had room for.
    const wide = zoomToFit({ width: 1024, height: 256 }, { width: 1000, height: 400 });
    expect(wide).toBe(Math.floor((1000 / ARTBOARD_PX) * 100));

    const scale = scaleFor({ width: 1024, height: 256 }, wide);
    expect(1024 * scale).toBeLessThanOrEqual(1000);
    expect(256 * scale).toBeLessThanOrEqual(400);
  });

  it('lets the short axis win when that is the binding one', () => {
    // The same board in a room that is wide but shallow.
    const scale = scaleFor({ width: 1024, height: 256 }, zoomToFit(
      { width: 1024, height: 256 },
      { width: 4000, height: 200 },
    ));
    expect(256 * scale).toBeLessThanOrEqual(200);
    expect(256 * scale).toBeGreaterThan(190);
  });
});
