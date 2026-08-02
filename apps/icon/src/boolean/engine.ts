import type { PathKit, SkPath, SkPathOp } from 'pathkit-wasm/bin/pathkit.js';
import { FLATTEN_TOLERANCE, nearestOnPath } from '../doc/geometry';
import type { PathSegment, Point } from '../doc/types';
import { pathData } from '../render/svg';
import type { BooleanEngine, BooleanOp } from './ops';

/**
 * The engine: Skia's PathOps, compiled to WebAssembly, behind `BooleanEngine`.
 *
 * This file is the only one in the app that knows a dependency exists. Béziers
 * crossing béziers is where hand-rolled geometry goes subtly wrong rather than
 * loudly wrong, and everything else in this app that could have been a
 * dependency — the ZIP writer, `.ico`, `.icns`, the SVG parser — is a format
 * whose errors are visible the moment you open the file. This one is not, which
 * is the whole reason it was bought.
 */

/**
 * Where the `.wasm` sits.
 *
 * `new URL(..., import.meta.url)` is load-bearing rather than stylistic. It is
 * the one form Vite rewrites — at build time into the hashed asset it emitted
 * beside the bundle, and in dev into a path it will serve out of
 * `node_modules` — so the same line answers correctly under `vite dev` and
 * `vite build`. A plain string would be resolved against the page's own address
 * at runtime instead and 404 under both, and the asset would not be emitted at
 * all.
 */
const bundledWasm = (): string => new URL('pathkit-wasm/bin/pathkit.wasm', import.meta.url).href;

const operationFor = (kit: PathKit, op: BooleanOp): SkPathOp => {
  switch (op) {
    case 'union':
      return kit.PathOp.UNION;
    case 'subtract':
      return kit.PathOp.DIFFERENCE;
    case 'intersect':
      return kit.PathOp.INTERSECT;
    case 'exclude':
      return kit.PathOp.XOR;
  }
};

/* ── conics ─────────────────────────────────────────────────────────────── */

/**
 * A conic: three control points and a weight.
 *
 * This is how Skia holds a circular arc — a rational quadratic, exact where a
 * polynomial curve can only approximate — and it is the one thing on its side
 * of the boundary that has no SVG command to come back as. Everything in this
 * section exists to turn one into commands a document can hold.
 */
export interface Conic {
  from: Point;
  control: Point;
  to: Point;
  weight: number;
}

type Cubic = Extract<PathSegment, { c: 'C' }>;

/** A point on the conic at `t`, straight from the rational form. */
function conicAt(conic: Conic, t: number): Point {
  const { from, control, to, weight } = conic;
  const u = 1 - t;
  const a = u * u;
  const b = 2 * u * t * weight;
  const c = t * t;
  const total = a + b + c;
  return {
    x: (a * from.x + b * control.x + c * to.x) / total,
    y: (a * from.y + b * control.y + c * to.y) / total,
  };
}

/**
 * The cubic that stands in for a conic.
 *
 * Both of its controls sit the same fraction of the way from an endpoint
 * towards the conic's own control point, and that fraction — 4w ⁄ 3(1+w) — is
 * what makes the two curves agree in four places rather than merely resemble
 * each other: the ends are shared outright, both controls land on the tangent
 * lines by construction, and the fraction itself is what comes out of setting
 * the cubic's midpoint (P₀+3Q₁+3Q₂+P₂)/8 equal to the conic's
 * (P₀+2wP₁+P₂)/(2+2w).
 *
 * Two ways to see that it is the fraction and not a plausible one. At w = 1 a
 * conic *is* a quadratic, and the fraction comes out 2/3 — exactly the degree
 * elevation `doc/geometry.ts` already raises a `Q` to a cubic by. At
 * w = cos 45°, which is what a quarter circle carries, it comes out 0.5522847,
 * the constant every drawing of a circle as four cubics is written with.
 */
function cubicFor(conic: Conic): Cubic {
  const { from, control, to, weight } = conic;
  const along = (4 * weight) / (3 * (1 + weight));
  return {
    c: 'C',
    x1: from.x + along * (control.x - from.x),
    y1: from.y + along * (control.y - from.y),
    x2: to.x + along * (control.x - to.x),
    y2: to.y + along * (control.y - to.y),
    x: to.x,
    y: to.y,
  };
}

/** How many places along a conic the substitution is measured at. */
const CONIC_SAMPLES = 16;

/**
 * How far the conic strays from the cubic standing in for it, in document
 * units.
 *
 * Measured to the cubic's **curve**, not to the cubic's point of the same
 * parameter, and the difference is not a detail. A conic and its cubic are
 * travelled at different speeds by construction — the substitution matches
 * where the two curves run, never when — so a parameter-matched distance
 * reports that difference as though the outline had moved: on a quarter circle
 * of radius 60 it reads 1.4 units where the two curves lie 0.016 apart, and
 * every arc in every document would be subdivided for nothing.
 *
 * The search is `nearestOnPath`, which is already the app's answer to "how far
 * is this point from that curve", so nothing here can disagree with the
 * flattener about the shape of a cubic.
 */
function strayOf(conic: Conic, cubic: Cubic): number {
  const outline: PathSegment[] = [{ c: 'M', x: conic.from.x, y: conic.from.y }, cubic];
  let worst = 0;
  for (let i = 1; i < CONIC_SAMPLES; i++) {
    const on = conicAt(conic, i / CONIC_SAMPLES);
    // A cubic always has an edge to measure against, so nothing found here
    // would mean the search itself had failed — which must not read as "close
    // enough" and let an unchecked curve through.
    worst = Math.max(worst, nearestOnPath(outline, on)?.distance ?? Number.POSITIVE_INFINITY);
  }
  return worst;
}

/**
 * The conic halved at its own midpoint, as two conics that between them trace
 * exactly the curve the one did.
 *
 * de Casteljau again, but performed on the homogeneous points (P₀,1), (wP₁,w)
 * and (P₂,1) and divided back afterwards — which is what leaves each half in
 * the standard form, weight one at both ends and a single weight in the middle,
 * rather than a rational curve carrying three weights that nothing downstream
 * could read. The halves' weight works out as √((1+w)/2), and they meet at the
 * conic's own midpoint rather than at the middle of its control triangle.
 */
function halveConic(conic: Conic): [Conic, Conic] {
  const { from, control, to, weight } = conic;
  const share = 1 / (1 + weight);
  const middle = conicAt(conic, 0.5);
  const half = Math.sqrt((1 + weight) / 2);
  const before = {
    x: (from.x + weight * control.x) * share,
    y: (from.y + weight * control.y) * share,
  };
  const after = {
    x: (weight * control.x + to.x) * share,
    y: (weight * control.y + to.y) * share,
  };
  return [
    { from, control: before, to: middle, weight: half },
    { from: middle, control: after, to, weight: half },
  ];
}

/**
 * How far a cubic may sit from the conic it replaces, in document units.
 *
 * The same quarter unit the flattener works to, and for the reason stated
 * there: half the finest snap step a document offers, so the substitution can
 * never be as much as one grid position out. Both are distances between curves
 * in artboard units, measured on artwork of the same size, so there is nothing
 * to choose between them — and taking the constant rather than restating it is
 * what stops the two approximations in this app drifting apart later.
 */
const CONIC_TOLERANCE = FLATTEN_TOLERANCE;

/**
 * How many times a conic may be halved before its cubic is taken as it stands.
 *
 * Sixteen pieces, which nothing a document can ask for comes near: halving a
 * circular arc cuts the deviation by around sixty-four times, so the quarter
 * circles Skia actually produces hold in one cubic until their radius passes
 * nine hundred units, and an arc of a hundred and fifty degrees holds in two.
 * The bound is here so that a degenerate weight cannot spin, not because
 * artwork reaches it.
 */
const CONIC_DEPTH = 4;

function halvedInto(conic: Conic, depth: number): Cubic[] {
  const cubic = cubicFor(conic);
  if (depth >= CONIC_DEPTH || strayOf(conic, cubic) <= CONIC_TOLERANCE) return [cubic];
  return halveConic(conic).flatMap((half) => halvedInto(half, depth + 1));
}

/**
 * A conic as one cubic, or as the few it takes to stay within
 * `CONIC_TOLERANCE` of it.
 *
 * Exported because it is the one part of this file whose answer can be checked
 * against arithmetic instead of against Skia: a conic is stated by a formula,
 * so what stands in for it can be sampled and measured, and a test that does
 * that is worth more than one asserting a command count.
 */
export function conicCubics(conic: Conic): Cubic[] {
  return halvedInto(conic, 0);
}

/**
 * The engine's answer as commands this document can hold.
 *
 * Read through `toCmds` and not `toSVGString`, which is the whole of this
 * file's answer to a donut carrying two hundred node handles. SVG has no
 * command for a conic, so `toSVGString` subdivides every one into a long run of
 * quadratics on the way out: a circle with a corner-curved rectangle taken out
 * of it came back as 264 commands, 256 of them `Q`, and the editor drew a
 * handle on each. The verb list hands the conic over whole, weight and all, and
 * a conic is one cubic or two.
 *
 * An arc does not come back an `A`, and that is deliberate. Skia's conic is a
 * rational quadratic and the only thing it is exactly is itself; writing one
 * back as an SVG arc would mean claiming a centre and two radii that a boolean
 * is under no obligation to have left circular. A cubic within a quarter unit
 * is the honest answer, and it is a command the editor already knows how to
 * reshape.
 */
function segmentsOf(kit: PathKit, path: SkPath): PathSegment[] {
  const segments: PathSegment[] = [];
  let at: Point = { x: 0, y: 0 };
  let opened: Point = at;

  for (const command of path.toCmds()) {
    const verb = command[0];
    // One flat list of numbers per command, so how many follow is the verb's to
    // know and not the type's. A missing one would mean Skia had broken its own
    // contract; falling back keeps that from becoming a non-null assertion.
    const arg = (index: number): number => command[index] ?? 0;

    if (verb === kit.MOVE_VERB) {
      at = { x: arg(1), y: arg(2) };
      opened = at;
      segments.push({ c: 'M', x: at.x, y: at.y });
    } else if (verb === kit.LINE_VERB) {
      at = { x: arg(1), y: arg(2) };
      segments.push({ c: 'L', x: at.x, y: at.y });
    } else if (verb === kit.QUAD_VERB) {
      at = { x: arg(3), y: arg(4) };
      segments.push({ c: 'Q', x1: arg(1), y1: arg(2), x: at.x, y: at.y });
    } else if (verb === kit.CONIC_VERB) {
      const to = { x: arg(3), y: arg(4) };
      segments.push(
        ...conicCubics({ from: at, control: { x: arg(1), y: arg(2) }, to, weight: arg(5) }),
      );
      at = to;
    } else if (verb === kit.CUBIC_VERB) {
      at = { x: arg(5), y: arg(6) };
      segments.push({
        c: 'C',
        x1: arg(1),
        y1: arg(2),
        x2: arg(3),
        y2: arg(4),
        x: at.x,
        y: at.y,
      });
    } else if (verb === kit.CLOSE_VERB) {
      // The pen goes back to where the subpath opened, which is where a conic
      // written after a close would have to start from.
      at = opened;
      segments.push({ c: 'Z' });
    } else {
      throw new Error('the engine answered with a command that could not be read');
    }
  }
  return segments;
}

/* ── the module ─────────────────────────────────────────────────────────── */

/**
 * Where the module comes from: a URL to fetch, or the bytes themselves.
 *
 * Two forms rather than one because the loader's own `locateFile` cannot answer
 * for both. Under Node it reaches for `fetch` whenever the global exists — it
 * does, from Node 18 on — and hands it whatever `locateFile` returned, so a
 * path on disk comes back as "unknown scheme"; spell that path as a `file://`
 * URL to steer it away from `fetch` and it takes the other branch, which runs
 * the URL through `path.normalize` before `readFileSync` and mangles it. There
 * is no string that works. Reading the file and handing over the bytes is the
 * way in from outside a browser, and it is the test runner's way in.
 */
export type WasmSource = string | Uint8Array;

/**
 * An engine, given somewhere to find the wasm.
 *
 * A parameter rather than a constant because the module is in a different place
 * for every consumer: a hashed asset URL in the built app, a `node_modules`
 * path under the dev server, and a file on disk under a test runner, where
 * there is no bundler to rewrite anything and no server to fetch from. The
 * default is the bundled one, so the app itself never states a path.
 */
export function pathKitEngine(locateWasm: () => WasmSource = bundledWasm): BooleanEngine {
  /**
   * Loaded on the first operation and never before it.
   *
   * The module is a quarter of a megabyte, and someone who opens the editor to
   * nudge a rectangle should not pay for it. A dynamic import rather than a top
   * one so the loader itself is a chunk of its own too — a static import would
   * put its 33 kB in the entry bundle whatever the wasm did. The promise is
   * kept rather than the module, so two operations started together load it
   * once between them.
   */
  let loading: Promise<PathKit> | null = null;
  const load = (): Promise<PathKit> =>
    (loading ??= import('pathkit-wasm/bin/pathkit.js').then((module) => {
      const source = locateWasm();
      return module.default(
        typeof source === 'string' ? { locateFile: () => source } : { wasmBinary: source },
      );
    }));

  return async (op, paths) => {
    const kit = await load();
    /**
     * Every path made, remembered the instant it exists.
     *
     * These are handles into the wasm heap and nothing in JavaScript's
     * collector can see them, so each has to be handed back by name. Collecting
     * them as they are made and freeing the list in `finally` is what makes
     * that true on the error path as well: an outline the engine refuses throws
     * between two allocations, and both are still in the list.
     */
    const made: SkPath[] = [];
    try {
      const read = (d: string): SkPath => {
        const path = kit.FromSVGString(d);
        if (!path) throw new Error('an outline could not be read');
        made.push(path);
        return path;
      };

      // **The base is the first operand, and the rest are folded into it.**
      // Skia's DIFFERENCE removes its argument from its receiver, so folding
      // left means every later operand comes out of what is left of the first —
      // which is what "subtract" has to mean if it is to mean anything
      // predictable. The other three are order-independent as arithmetic, and
      // are folded the same way rather than three different ways.
      const [first, ...rest] = paths;
      if (first === undefined || rest.length === 0) {
        throw new Error('a boolean operation takes two outlines at least');
      }
      const operation = operationFor(kit, op);
      const base = read(first);
      for (const d of rest) {
        // In place: `op` rewrites the receiver and hands it back, so `base` is
        // the running answer and no path is allocated by the fold itself.
        if (!base.op(read(d), operation)) {
          throw new Error(`the ${op} of these outlines could not be worked out`);
        }
      }
      return pathData(segmentsOf(kit, base));
    } finally {
      for (const path of made) path.delete();
    }
  };
}

/**
 * The engine the app runs on. Constructing it loads nothing — the module is
 * still asleep until the first operation asks for it.
 */
export const booleanOf: BooleanEngine = pathKitEngine();
