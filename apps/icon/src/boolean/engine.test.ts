import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { FLATTEN_TOLERANCE, contains, flattenPath, pointsBox } from '../doc/geometry';
import { parsePathData } from '../import/parse';
import { pathData } from '../render/svg';
import type { IconObject, PathSegment, Point } from '../doc/types';
import { conicCubics, pathKitEngine, type Conic, type WasmSource } from './engine';
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

/**
 * A disc, and a corner-curved square sitting well inside it — the pair whose
 * difference is a donut. Written through `pathOf` rather than by hand, so the
 * operands are exactly what the app hands the engine: arcs, not curves already
 * chopped up by something else.
 */
const DISC = pathData(pathOf({ kind: 'circle', cx: 100, cy: 100, r: 60 }));
const INNER = pathData(pathOf({ kind: 'rect', x: 75, y: 75, w: 50, h: 50, radius: 10 }));

/** The longest run of one kind of command, back to back. */
function longestRun(segments: readonly PathSegment[], kind: PathSegment['c']): number {
  let longest = 0;
  let running = 0;
  for (const segment of segments) {
    running = segment.c === kind ? running + 1 : 0;
    longest = Math.max(longest, running);
  }
  return longest;
}

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

/* ── conics ─────────────────────────────────────────────────────────────── */

/**
 * A conic sampled from the rational form itself, spelled out here rather than
 * borrowed from `engine.ts`. A test that samples the curve with the same code
 * the answer was built from proves only that arithmetic is repeatable.
 */
function conicPoint(conic: Conic, t: number): Point {
  const u = 1 - t;
  const a = u * u;
  const b = 2 * u * t * conic.weight;
  const c = t * t;
  const total = a + b + c;
  return {
    x: (a * conic.from.x + b * conic.control.x + c * conic.to.x) / total,
    y: (a * conic.from.y + b * conic.control.y + c * conic.to.y) / total,
  };
}

/** A cubic sampled from the Bernstein form, for the same reason. */
function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

const SAMPLES = 200;

/** How far a point sits from the segment a→b. */
function awayFromEdge(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  if (length === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/**
 * The widest gap between the conic and the run of cubics standing in for it.
 *
 * Every sampled point of the conic is measured to the nearest point of the
 * curve — never to the cubic's point of the same parameter, which measures how
 * fast each is travelled and not where either one lies.
 *
 * The cubics are measured as the chords between their samples rather than as
 * the samples themselves. Distance to the nearest *sample* is dominated by how
 * far apart the samples are — on a quarter circle of radius 60 it reads 0.24
 * where the curves lie 0.016 apart, which is half a sample step and nothing to
 * do with the answer. Distance to the chords overstates by the chord's own
 * bulge instead, which is a five-hundredth of that.
 */
function widestGap(conic: Conic, cubics: readonly Extract<PathSegment, { c: 'C' }>[]): number {
  const edges: Point[][] = [];
  // Each cubic begins where the one before it ended, and the first where the
  // conic did — a `C` states no start of its own.
  let at = conic.from;
  for (const cubic of cubics) {
    const first = { x: cubic.x1, y: cubic.y1 };
    const second = { x: cubic.x2, y: cubic.y2 };
    const end = { x: cubic.x, y: cubic.y };
    const run: Point[] = [];
    for (let j = 0; j <= SAMPLES; j++) {
      run.push(cubicPoint(at, first, second, end, j / SAMPLES));
    }
    edges.push(run);
    at = end;
  }

  let worst = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const on = conicPoint(conic, i / SAMPLES);
    let nearest = Number.POSITIVE_INFINITY;
    for (const run of edges) {
      for (let j = 1; j < run.length; j++) {
        const a = run[j - 1];
        const b = run[j];
        if (!a || !b) continue;
        nearest = Math.min(nearest, awayFromEdge(on, a, b));
      }
    }
    worst = Math.max(worst, nearest);
  }
  return worst;
}

/**
 * A circular arc of `degrees` about the origin, as a conic: the control point
 * is where the two end tangents meet and the weight is cos(θ/2), which is the
 * form Skia stores one in.
 */
function arcConic(radius: number, degrees: number): Conic {
  const half = ((degrees / 2) * Math.PI) / 180;
  const weight = Math.cos(half);
  return {
    from: { x: radius * Math.cos(-half), y: radius * Math.sin(-half) },
    control: { x: radius / weight, y: 0 },
    to: { x: radius * Math.cos(half), y: radius * Math.sin(half) },
    weight,
  };
}

describe('a conic, as the cubics that stand in for it', () => {
  it('holds a quarter circle in one cubic, within a fraction of the tolerance', () => {
    const conic = arcConic(60, 90);
    const cubics = conicCubics(conic);

    expect(cubics).toHaveLength(1);
    expect(widestGap(conic, cubics)).toBeLessThan(FLATTEN_TOLERANCE / 10);
    // The one command it becomes ends where the conic ended, exactly.
    expect(cubics[0]?.x).toBeCloseTo(conic.to.x, 9);
    expect(cubics[0]?.y).toBeCloseTo(conic.to.y, 9);
  });

  it('halves a conic too wide for one cubic rather than letting it stray', () => {
    // Five twelfths of a turn: the same radius as above, so what makes this one
    // take more than one cubic is how far it bends and nothing else.
    const conic = arcConic(60, 150);
    const cubics = conicCubics(conic);

    expect(cubics.length).toBeGreaterThan(1);
    expect(widestGap(conic, cubics)).toBeLessThan(FLATTEN_TOLERANCE);
    // Whatever it was cut into, the run still ends where the conic does.
    expect(cubics[cubics.length - 1]?.x).toBeCloseTo(conic.to.x, 9);
    expect(cubics[cubics.length - 1]?.y).toBeCloseTo(conic.to.y, 9);
  });

  it('subdivides on how far the answer strays, not on how wide the arc is', () => {
    // A quarter circle again, but big enough that a single cubic could no
    // longer hold it inside a quarter of a document unit.
    expect(conicCubics(arcConic(60, 90))).toHaveLength(1);
    expect(conicCubics(arcConic(4000, 90)).length).toBeGreaterThan(1);
    expect(widestGap(arcConic(4000, 90), conicCubics(arcConic(4000, 90)))).toBeLessThan(
      FLATTEN_TOLERANCE,
    );
  });
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

  it('answers a donut in commands you could count on your fingers', async () => {
    const segments = parsePathData(await engine('subtract', [DISC, INNER])).segments;

    // Two rings, each a move, four curves and a close, with the four straight
    // sides of the inner one between them. Read out of `toSVGString` the same
    // answer arrived as 264 commands, 256 of them quadratics — a shape with two
    // hundred node handles on it.
    expect(segments.length).toBeLessThan(30);
  });

  it('states its curves as curves rather than as a drift of quadratics', async () => {
    const segments = parsePathData(await engine('subtract', [DISC, INNER])).segments;

    expect(segments.filter((segment) => segment.c === 'C').length).toBeGreaterThan(0);
    // One quadratic is a shape Skia may honestly be holding; a run of them is a
    // curve that has been chopped into pieces on the way out, which is the
    // defect itself.
    expect(longestRun(segments, 'Q')).toBeLessThanOrEqual(1);
  });

  it('leaves the hole a hole, and the shape the shape it was', async () => {
    const d = await engine('subtract', [DISC, INNER]);
    const result = shapeOf(d);

    // The square's old footprint is no longer part of the shape — including the
    // corner, which only a curve that came back curved could cut away.
    expect(contains(result, { x: 100, y: 100 })).toBe(false);
    expect(contains(result, { x: 80, y: 80 })).toBe(false);
    // The ring between the square and the disc's edge still is, all the way
    // round.
    expect(contains(result, { x: 100, y: 45 })).toBe(true);
    expect(contains(result, { x: 145, y: 100 })).toBe(true);
    expect(contains(result, { x: 100, y: 155 })).toBe(true);
    expect(contains(result, { x: 45, y: 100 })).toBe(true);
    // And it reaches no further than the disc ever did.
    expect(contains(result, { x: 100, y: 30 })).toBe(false);
    const box = boxOf(d);
    expect(box.x).toBeCloseTo(40, 2);
    expect(box.y).toBeCloseTo(40, 2);
    expect(box.w).toBeCloseTo(120, 2);
    expect(box.h).toBeCloseTo(120, 2);
  });

  it('emits no curve at all where neither shape had one', async () => {
    const segments = parsePathData(await engine('union', [SQUARE, OVERLAP])).segments;

    expect(segments.length).toBeGreaterThan(0);
    expect(segments.filter((segment) => segment.c === 'C' || segment.c === 'Q')).toEqual([]);
    expect(segments.filter((segment) => segment.c === 'A')).toEqual([]);
  });
});
