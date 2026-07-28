import type { ClassValue } from 'clsx';

/**
 * A named domain one option can vary over — the tone ramp, a size ladder, an
 * on/off state. The name is the prop it surfaces as, so `axis('scale', …)`
 * gives the component a `scale` prop with this domain.
 *
 * The domain is either a list of values (the callback receives the value
 * itself) or a record (the callback receives the record's entry). The record
 * form is what lets a tone axis hand over a resolved ramp — `t.solid` rather
 * than a bare `'indigo'` the call site then has to combine with a STEP.
 */
export interface Axis<Name extends string = string, Key extends string = string, Handle = unknown> {
  readonly name: Name;
  readonly keys: readonly Key[];
  readonly fallback: Key;
  readonly resolve: (key: Key) => Handle;
}

export function axis<const Name extends string, const Keys extends readonly string[]>(
  name: Name,
  domain: Keys,
  fallback: Keys[number],
): Axis<Name, Keys[number], Keys[number]>;
export function axis<const Name extends string, Key extends string, Handle>(
  name: Name,
  domain: Record<Key, Handle>,
  fallback: NoInfer<Key>,
): Axis<Name, Key, Handle>;
export function axis(
  name: string,
  domain: readonly string[] | Record<string, unknown>,
  fallback: string,
): Axis {
  if (Array.isArray(domain)) {
    return { name, keys: domain, fallback, resolve: (key) => key };
  }
  const record = domain as Record<string, unknown>;
  return { name, keys: Object.keys(record), fallback, resolve: (key) => record[key] };
}

const OVER = Symbol('variants.over');

/**
 * One option's classes, as a function of one or more axes. Holds its own axes
 * so `variants` can derive the group's params from the options rather than
 * making every call site restate them.
 *
 * `Params` is carried in the type only — it is what tells `variants` which
 * props this option contributes, and is never read at runtime.
 */
export interface Expansion<Params = unknown> {
  readonly [OVER]: true;
  readonly axes: readonly Axis[];
  /** Classes for one selection, memoised on first use. */
  at(selection: Record<string, unknown>): ClassValue;
  /** Every combination — walked once, by the safelist. */
  every(): ClassValue[];
  readonly params?: Params;
}

export function isExpansion(value: unknown): value is Expansion {
  return typeof value === 'object' && value !== null && OVER in value;
}

/** The prop one axis contributes: optional, narrowed to its own domain. */
type Prop<Name extends string, Key extends string> = { [P in Name]?: Key };

export function over<N extends string, K extends string, H>(
  a: Axis<N, K, H>,
  build: (a: H) => ClassValue,
): Expansion<Prop<N, K>>;
export function over<N1 extends string, K1 extends string, H1, N2 extends string, K2 extends string, H2>(
  a: Axis<N1, K1, H1>,
  b: Axis<N2, K2, H2>,
  build: (a: H1, b: H2) => ClassValue,
): Expansion<Prop<N1, K1> & Prop<N2, K2>>;
export function over<
  N1 extends string, K1 extends string, H1,
  N2 extends string, K2 extends string, H2,
  N3 extends string, K3 extends string, H3,
>(
  a: Axis<N1, K1, H1>,
  b: Axis<N2, K2, H2>,
  c: Axis<N3, K3, H3>,
  build: (a: H1, b: H2, c: H3) => ClassValue,
): Expansion<Prop<N1, K1> & Prop<N2, K2> & Prop<N3, K3>>;
export function over(...args: unknown[]): Expansion {
  const build = args[args.length - 1] as (...handles: unknown[]) => ClassValue;
  const axes = args.slice(0, -1) as Axis[];

  // Lazy, not eager: a tone x size x state option is 102 combinations, and an
  // app renders a handful of them. Building all of it at import would cost
  // every consumer startup time for classes they never use, so combinations
  // are built on first render and kept. `every()` still walks the whole space,
  // but only the safelist ever calls it.
  const cache = new Map<string, ClassValue>();

  function classesFor(keys: string[]): ClassValue {
    const id = keys.join('|');
    let found = cache.get(id);
    if (found === undefined) {
      found = build(...axes.map((ax, i) => ax.resolve(keys[i]!)));
      cache.set(id, found);
    }
    return found;
  }

  return {
    [OVER]: true,
    axes,
    at(selection) {
      return classesFor(
        axes.map((ax) => {
          const picked = selection[ax.name];
          // An axis only answers to its own domain: a `scale` of `primary` is a
          // tone name, not a ramp name, and indexing the ramp table with it
          // would yield undefined-laden classes rather than an obvious failure.
          return typeof picked === 'string' && (ax.keys as readonly string[]).includes(picked)
            ? picked
            : ax.fallback;
        }),
      );
    },
    every() {
      let combinations: string[][] = [[]];
      for (const ax of axes) {
        combinations = combinations.flatMap((prefix) => ax.keys.map((key) => [...prefix, key]));
      }
      return combinations.map(classesFor);
    },
  };
}
