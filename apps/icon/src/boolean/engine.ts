import type { PathKit, SkPath, SkPathOp } from 'pathkit-wasm/bin/pathkit.js';
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
      return base.toSVGString();
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
