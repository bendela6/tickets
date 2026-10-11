/**
 * A config key loaded rather than written: `fn` is called with the values of
 * the fields `dependsOn` names, and again whenever they change.
 */
export interface AsyncResolver<T, Deps extends readonly string[] = readonly string[]> {
  /** Loads the key's value from those fields' values. */
  fn: (deps: Record<Deps[number], unknown>) => Promise<T>;
  /** The fields it reads, by name. */
  dependsOn: Deps;
}

/** A config key's value, or a resolver that loads it. */
export type MaybeAsync<T> = T | AsyncResolver<T>;

/** Whether a config key's value is a resolver to load it with. */
export function isAsyncResolver<T>(value: MaybeAsync<T>): value is AsyncResolver<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fn' in value &&
    'dependsOn' in value &&
    typeof (value as unknown as { fn: unknown }).fn === 'function' &&
    Array.isArray((value as unknown as { dependsOn: unknown }).dependsOn)
  );
}

/** An input's config as a field writes it: any key may be an `AsyncResolver`. */
export type AuthorConfig<TResolved> = { [K in keyof TResolved]: MaybeAsync<TResolved[K]> };
