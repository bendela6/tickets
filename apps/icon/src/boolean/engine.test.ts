import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { contains, flattenPath, pointsBox } from '../doc/geometry';
import { parsePathData } from '../import/parse';
import { pathData } from '../render/svg';
import type { IconObject } from '../doc/types';
import { pathKitEngine, type WasmSource } from './engine';
import { nonZeroWound, pathOf } from './ops';

/**
 * The real engine, running the real WebAssembly.
 *
 * Everything else about this feature is proved against a fake, which is the
 * return on having stated the engine as one function — but a fake proves the
 * app's half and nothing at all about Skia's, and the one thing that cannot be
 * asserted from the app side is that a subtraction actually removes anything.
 *
 * Node has `WebAssembly`, so the module runs here exactly as it does in a
 * browser. What it does not have is a way to *find* the file: see `WasmSource`
 * for why a path cannot be handed to the loader from outside a browser. The
 * bytes are read here and handed straight over, which is the same module
 * arriving by a different road.
 */
const require = createRequire(import.meta.url);
const wasmOnDisk = (): WasmSource =>
  new Uint8Array(readFileSync(require.resolve('pathkit-wasm/bin/pathkit.wasm')));

/** A square, 100 units on a side, at the origin. */
const SQUARE = 'M0 0 L100 0 L100 100 L0 100 Z';
/** A circle of radius 30 about the square's centre, as two arcs. */
const HOLE = 'M20 50 A30 30 0 1 1 80 50 A30 30 0 1 1 20 50 Z';
/** A square overlapping the first one's bottom-right quarter. */
const OVERLAP = 'M50 50 L150 50 L150 150 L50 150 Z';

/** The box round a `d` string, measured through the flattener. */
const boxOf = (d: string) => pointsBox(flattenPath(parsePathData(d).segments).flat());

/** A stand-in object, so `contains` can be asked about a bare `d` string. */
const shapeOf = (d: string): IconObject => ({
  id: 'result',
  name: 'result',
  geometry: { kind: 'path', segments: nonZeroWound(parsePathData(d).segments) },
  fill: { light: '#000000', dark: '#FFFFFF' },
  stroke: { light: '#000000', dark: '#FFFFFF' },
  strokeWidth: 0,
  opacity: 100,
  rotation: 0,
  hidden: false,
  locked: false,
});

describe('the engine, on the real module', () => {
  /**
   * One engine for the whole file. Each one loads a module of its own, and a
   * module of its own is a quarter of a megabyte and a handful of listeners on
   * the process — the laziness case below wants a fresh one, and nothing else
   * does.
   */
  const engine = pathKitEngine(wasmOnDisk);

  it('does not reach for the wasm until the first operation asks for it', async () => {
    const locate = vi.fn(wasmOnDisk);
    const engine = pathKitEngine(locate);
    // Constructed, and a quarter of a megabyte has still not been touched.
    expect(locate).not.toHaveBeenCalled();

    await engine('union', [SQUARE, OVERLAP]);
    expect(locate).toHaveBeenCalledTimes(1);

    // And a second operation reuses what the first loaded, rather than paying
    // for it again.
    await engine('union', [SQUARE, OVERLAP]);
    expect(locate).toHaveBeenCalledTimes(1);
  });

  it('subtracts a circle from a rectangle and leaves a hole', async () => {
    const result = shapeOf(await engine('subtract', [SQUARE, HOLE]));

    // Two contours: the square, and the circle taken out of the middle of it.
    const geometry = result.geometry;
    expect(geometry.kind).toBe('path');
    expect(flattenPath(geometry.kind === 'path' ? geometry.segments : [])).toHaveLength(2);
    // The middle is no longer part of the shape; the corner still is.
    expect(contains(result, { x: 50, y: 50 })).toBe(false);
    expect(contains(result, { x: 5, y: 5 })).toBe(true);
  });

  it('winds the hole against its body, so the non-zero rule draws it', async () => {
    const geometry = shapeOf(await engine('subtract', [SQUARE, HOLE])).geometry;
    if (geometry.kind !== 'path') throw new Error('the result is not a path');

    // Shoelace over each contour: the two must disagree in sign, or non-zero
    // fills the hole in and the picture is a plain square.
    const areas = flattenPath(geometry.segments).map((run) =>
      run.reduce((sum, point, index) => {
        const previous = run[(index + run.length - 1) % run.length] ?? point;
        return sum + (previous.x - point.x) * (previous.y + point.y);
      }, 0),
    );
    expect(areas).toHaveLength(2);
    expect(Math.sign(areas[0] ?? 0)).not.toBe(Math.sign(areas[1] ?? 0));
  });

  it('reads its answer back through the importer’s own parser', async () => {
    const d = await engine('union', [SQUARE, OVERLAP]);

    const parsed = parsePathData(d);
    expect(parsed.error).toBeNull();
    expect(parsed.segments.length).toBeGreaterThan(0);
    // The L shape the two squares make together, corner to corner.
    expect(boxOf(d)).toEqual({ x: 0, y: 0, w: 150, h: 150 });
  });

  it('takes the first operand as the base, so the order decides what is removed', async () => {
    // The first square minus the second keeps the first's top-left corner and
    // loses its bottom-right quarter.
    const forwards = shapeOf(await engine('subtract', [SQUARE, OVERLAP]));
    expect(contains(forwards, { x: 10, y: 10 })).toBe(true);
    expect(contains(forwards, { x: 90, y: 90 })).toBe(false);

    // The same two the other way round is a different shape entirely.
    const backwards = shapeOf(await engine('subtract', [OVERLAP, SQUARE]));
    expect(contains(backwards, { x: 10, y: 10 })).toBe(false);
    expect(contains(backwards, { x: 140, y: 140 })).toBe(true);
  });

  it('intersects to the overlap alone, and excludes to everything but it', async () => {
    expect(boxOf(await engine('intersect', [SQUARE, OVERLAP]))).toEqual({
      x: 50,
      y: 50,
      w: 50,
      h: 50,
    });

    const exclusive = shapeOf(await engine('exclude', [SQUARE, OVERLAP]));
    expect(contains(exclusive, { x: 75, y: 75 })).toBe(false);
    expect(contains(exclusive, { x: 10, y: 10 })).toBe(true);
    expect(contains(exclusive, { x: 140, y: 140 })).toBe(true);
  });

  it('keeps a curve a curve rather than a run of straight lines', async () => {
    // A circle unioned with a square it sits well clear of: the circle's own
    // outline comes back untouched, and it is still made of curves.
    const d = await engine('union', ['M200 200 L260 200 L260 260 L200 260 Z', HOLE]);
    const curves = parsePathData(d).segments.filter(
      (segment) => segment.c === 'C' || segment.c === 'Q',
    );
    expect(curves.length).toBeGreaterThan(0);
  });

  it('refuses an outline it cannot read rather than answering with nothing', async () => {
    await expect(engine('union', ['nonsense', SQUARE])).rejects.toThrow(/could not be read/);
  });

  it('answers with an empty outline when two shapes do not meet', async () => {
    const d = await engine('intersect', [SQUARE, 'M300 300 L400 300 L400 400 L300 400 Z']);
    expect(parsePathData(d).segments).toEqual([]);
  });

  it('takes every kind of shape, because every kind can be written as commands', async () => {
    const curvedBox = pathData(
      pathOf({ kind: 'rect', x: 0, y: 0, w: 100, h: 100, radius: 20 }),
    );
    const circle = pathData(pathOf({ kind: 'circle', cx: 100, cy: 100, r: 40 }));

    // The curved corner is genuinely curved: the union reaches the circle's
    // far edge, and the box's own corner is still cut away.
    const result = shapeOf(await engine('union', [curvedBox, circle]));
    expect(contains(result, { x: 1, y: 1 })).toBe(false);
    expect(contains(result, { x: 135, y: 100 })).toBe(true);
  });
});
