import type { StandardIssue, StandardSchema } from './standard-schema';

// A registry: entries by name, which code looks up by the name a template, a
// view or a request gives. bh's renderers, layouts and formats are each one,
// and so is an app's own of anything. It is defined once with what its entries
// are and how each is checked; `define` checks and types one entry, and
// `register` gives a new registry with entries beside its own, so bh's stays
// as it is and an app's is bh's and more. A name is never taken twice, and
// asking for one it doesn't hold throws, saying which it does.

/** What a registry's entries are, and how each is checked. */
export interface RegistrySpec<T> {
  /** What an entry is called, in messages: 'renderer', 'format'. */
  name: string;
  /**
   * Checks each entry as it is defined and registered: any Standard Schema
   * (valibot, zod, arktype), its output part of the entry's type. It checks
   * the entry's data (its kinds, its width); the entry kept is the one given.
   */
  schema?: StandardSchema<unknown, Partial<T>>;
  /**
   * Rules across the entries, run on every registry built: throws on one
   * that fails, as a format taking a kind nothing registered.
   */
  check?: (registry: RegistryOf<T>) => void;
}

/**
 * What looking entries up needs, of any registry holding `T`, whatever its
 * `define` and its names: what a function that draws or runs by name takes,
 * bh's registry or an app's with more in it.
 */
export interface RegistryOf<T> {
  /** What an entry is called, in messages: 'renderer'. */
  readonly name: string;
  /** Its entries' names, in the order they were registered. */
  readonly names: readonly string[];
  /** The entry by its name. Throws, saying which names it holds, for one it doesn't. */
  get(name: string): T;
  /** Whether it holds an entry by this name. */
  has(name: string): boolean;
  /** Its entries, in the order they were registered. */
  values(): T[];
  /** Its entries with their names, in the order they were registered. */
  entries(): [string, T][];
}

/**
 * A registry's entries by name. `T` is what it holds; `D` is its `define`;
 * `M` is its entries by name, so `get` of a name it was given is typed.
 */
export interface Registry<
  T,
  D = <E extends T>(entry: E) => E,
  M extends Record<string, T> = Record<never, T>,
> extends RegistryOf<T> {
  /** Its entries' names, in the order they were registered. */
  readonly names: readonly (keyof M & string)[];
  /**
   * One entry, checked by the registry's schema and typed by its `define`:
   * what `register` takes. Throws, saying what is wrong, on one it refuses.
   */
  readonly define: D;
  /**
   * A new registry, its own entries and these, each named by its key. Throws
   * on a name it holds already, and on an entry its schema or check refuses.
   */
  register<E extends Record<string, T>>(entries: E): Registry<T, D, M & E>;
  /**
   * A new registry, with these entries in place of its own of the same names:
   * an app's link renderer over bh's. Throws on a name it doesn't hold.
   */
  override<E extends { [K in keyof M]?: T }>(entries: E): Registry<T, D, Omit<M, keyof E> & E>;
  /** The entry by its name. Throws, saying which names it holds, for one it doesn't. */
  get<K extends keyof M & string>(name: K): M[K];
  get(name: string): T;
  /** Whether it holds an entry by this name. */
  has(name: string): name is keyof M & string;
  /** Its entries, in the order they were registered. */
  values(): T[];
  /** Its entries with their names, in the order they were registered. */
  entries(): [keyof M & string, T][];
}

/**
 * A registry's entries by name, as it was given them: what a type read off
 * its names takes (`keyof EntriesOf<typeof baseInputs>`, a form's kinds).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EntriesOf<R> = R extends Registry<any, any, infer M> ? M : never;

/** 'A kind', 'An operator': what an entry is called, with its article. */
function aOne(what: string): string {
  return `${/^[aeiou]/i.test(what) ? 'An' : 'A'} ${what}`;
}

/** An issue, with where it is: 'kinds.0: Invalid length'. */
function issueText(issue: StandardIssue): string {
  const path = (issue.path ?? [])
    .map((step) => String(typeof step === 'object' ? step.key : step))
    .join('.');
  return path === '' ? issue.message : `${path}: ${issue.message}`;
}

/** Throws when the schema refuses an entry, or names it other than its key. */
function checkEntry<T>(spec: RegistrySpec<T>, name: string | undefined, entry: unknown): void {
  const who = name === undefined ? spec.name : `${spec.name} "${name}"`;
  const own =
    typeof entry === 'object' && entry !== null ? (entry as { name?: unknown }).name : undefined;
  if (name !== undefined && typeof own === 'string' && own !== name) {
    throw new Error(`The ${who} is named "${own}": register it by its own name.`);
  }
  if (spec.schema === undefined) {
    return;
  }
  const result = spec.schema['~standard'].validate(entry);
  if (result instanceof Promise) {
    throw new Error(
      `The ${spec.name} schema checks asynchronously; a registry needs an answer at once.`,
    );
  }
  if (result.issues) {
    throw new Error(`${who}: ${result.issues.map(issueText).join('; ')}`);
  }
}

function build<T, D, M extends Record<string, T>>(
  spec: RegistrySpec<T>,
  define: D,
  held: ReadonlyMap<string, T>,
): Registry<T, D, M> {
  const names = Object.freeze([...held.keys()]) as readonly (keyof M & string)[];
  // One body for both of get's signatures: an entry held by a name M gives is M's.
  const get = ((name: string): T => {
    if (!held.has(name)) {
      const known = names.length === 0 ? 'none' : names.join(', ');
      throw new Error(`No ${spec.name} is registered as "${name}". Registered: ${known}.`);
    }
    return held.get(name) as T;
  }) as Registry<T, D, M>['get'];
  const registry: Registry<T, D, M> = Object.freeze({
    name: spec.name,
    names,
    define,
    register<E extends Record<string, T>>(entries: E) {
      const next = new Map(held);
      for (const [name, entry] of Object.entries(entries)) {
        if (next.has(name)) {
          throw new Error(
            `${aOne(spec.name)} is registered as "${name}" already: override replaces one.`,
          );
        }
        checkEntry(spec, name, entry);
        next.set(name, entry);
      }
      return build<T, D, M & E>(spec, define, next);
    },
    override<E extends { [K in keyof M]?: T }>(entries: E) {
      const next = new Map(held);
      for (const [name, entry] of Object.entries(entries) as [string, T][]) {
        if (!next.has(name)) {
          throw new Error(
            `No ${spec.name} is registered as "${name}" to override: register adds one.`,
          );
        }
        checkEntry(spec, name, entry);
        next.set(name, entry);
      }
      return build<T, D, Omit<M, keyof E> & E>(spec, define, next);
    },
    get,
    has(name: string): name is keyof M & string {
      return held.has(name);
    },
    values() {
      return [...held.values()];
    },
    entries() {
      return [...held.entries()] as [keyof M & string, T][];
    },
  });
  spec.check?.(registry);
  return registry;
}

/**
 * A registry of entries whose type has type parameters of its own, as a
 * renderer's options: `define` gives each entry's shape, parameters and all,
 * and what it returns is what the registry holds.
 *
 * ```ts
 * const renderers = defineRegistry({
 *   name: 'renderer',
 *   schema: rendererData,
 *   // eslint-disable-next-line @typescript-eslint/no-explicit-any
 *   define: <O>(entry: RendererDefinition<O>): RendererDefinition<any> => entry,
 * });
 * ```
 */
export function defineRegistry<D extends (entry: never) => unknown>(
  spec: RegistrySpec<ReturnType<D>> & { define: D },
): Registry<ReturnType<D>, D>;
/**
 * A registry of entries of one type, `T`: `defineRegistry<Formatter>({ name: 'format' })`.
 * Empty: `register` gives one holding entries.
 */
export function defineRegistry<T>(spec: RegistrySpec<T>): Registry<T>;
export function defineRegistry<T>(
  spec: RegistrySpec<T> & { define?: (entry: T) => T },
): Registry<T, (entry: T) => T> {
  const own = spec.define;
  const define = (entry: T): T => {
    checkEntry(spec, undefined, entry);
    return own === undefined ? entry : own(entry);
  };
  return build(spec, define, new Map());
}
