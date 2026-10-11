export type ResolvedEntry<T> =
  | { status: 'pending'; promise: Promise<T>; token: number }
  | { status: 'success'; value: T; token: number }
  | { status: 'error'; error: Error; token: number };

export type ResolverCache = Map<string, ResolvedEntry<unknown>>;

export function createResolverCache(): ResolverCache {
  return new Map();
}
