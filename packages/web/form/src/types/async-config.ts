export interface AsyncResolver<T, Deps extends readonly string[] = readonly string[]> {
  fn: (deps: Record<Deps[number], unknown>) => Promise<T>;
  dependsOn: Deps;
}

export type MaybeAsync<T> = T | AsyncResolver<T>;

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

export type AuthorConfig<TResolved> = { [K in keyof TResolved]: MaybeAsync<TResolved[K]> };
