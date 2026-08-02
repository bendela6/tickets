/**
 * Types for `pathkit-wasm`, which ships none of its own.
 *
 * Hand-written, and deliberately no wider than `engine.ts` actually reaches.
 * The package is Skia's PathOps compiled to WebAssembly and its surface is
 * large — a whole path builder, canvas interop, stroking, dashing, trimming —
 * and typing all of it off the documentation would be a second, unverified copy
 * of an API nothing here calls. What is declared is what is called; anything
 * else stops compiling, which is the signal to widen this rather than to widen
 * it in advance.
 *
 * The `.js` suffix is part of the specifier on purpose: the package's `main`
 * would resolve to the same file, but an ambient declaration is matched against
 * the string that is written, and `engine.ts` imports the file by path so the
 * bundler can code-split it.
 */
declare module 'pathkit-wasm/bin/pathkit.js' {
  /**
   * Which operation to perform, as embind hands it over.
   *
   * Opaque: it is read off `PathKit.PathOp` and passed straight back, so its
   * representation is the binding layer's business and not something this app
   * should claim to know. The brand is what stops any other value being handed
   * to `op` in its place.
   */
  const skPathOp: unique symbol;
  export interface SkPathOp {
    readonly [skPathOp]: never;
  }

  export interface SkPath {
    /**
     * Skia's path operation, performed **in place**: `this` becomes the result
     * and is returned, or null when the operation fails. The receiver is the
     * left-hand operand, which is what makes `DIFFERENCE` mean "the receiver
     * minus the argument".
     */
    op(other: SkPath, operation: SkPathOp): SkPath | null;
    /**
     * The path as Skia's own verbs: one entry per command, the verb first and
     * that verb's numbers after it — `[MOVE_VERB, x, y]`,
     * `[CONIC_VERB, x1, y1, x, y, w]`, `[CLOSE_VERB]`. Loosely typed because
     * that is what it is: the length and the meaning of the tail are the verb's
     * to decide, and a tuple per verb would be a union the runtime never hands
     * over.
     *
     * Read in place of `toSVGString`, which is the other spelling the module
     * offers and is not declared here because nothing calls it: SVG has no
     * command for a conic, so that route subdivides every one into a run of
     * quadratics before the caller ever sees the weight.
     */
    toCmds(): number[][];
    /**
     * Frees the wasm memory this path holds. Not optional and not a hint —
     * nothing in JavaScript's collector can see the heap this lives on.
     */
    delete(): void;
  }

  export interface PathKit {
    /** Null when the string is not something SVG could draw. */
    FromSVGString(d: string): SkPath | null;
    /**
     * The verb each command from `toCmds` opens with.
     *
     * Read off the module rather than written down as the numbers they happen
     * to be: they are the binding layer's own constants, and a table of six
     * integers copied into this file would be a second place they were decided.
     * `number` rather than a literal type for the same reason — this file has
     * no business fixing their values.
     */
    readonly MOVE_VERB: number;
    readonly LINE_VERB: number;
    readonly QUAD_VERB: number;
    readonly CONIC_VERB: number;
    readonly CUBIC_VERB: number;
    readonly CLOSE_VERB: number;
    readonly PathOp: {
      readonly UNION: SkPathOp;
      readonly DIFFERENCE: SkPathOp;
      readonly INTERSECT: SkPathOp;
      readonly XOR: SkPathOp;
    };
  }

  export interface PathKitOptions {
    /**
     * Where the `.wasm` file is. Called with the name the loader is looking for
     * and the prefix it worked out for itself, and whatever comes back is
     * fetched.
     */
    locateFile?: (file: string, prefix: string) => string;
    /**
     * The module's bytes, for a caller that has them already. Short-circuits
     * `locateFile` and every route the loader would otherwise take to find
     * them.
     */
    wasmBinary?: Uint8Array;
  }

  const PathKitInit: (options?: PathKitOptions) => Promise<PathKit>;
  export default PathKitInit;
}
