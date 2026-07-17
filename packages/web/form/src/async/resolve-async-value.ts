import type { AsyncResolver } from '../types/async-config';
import type { ResolverCache, ResolvedEntry } from './resolver-cache';

export class StaleResolutionError extends Error {
  override readonly name = 'StaleResolutionError';
  constructor() {
    super('Resolution superseded by a newer dependency change');
  }
}

export interface ResolveOptions {
  invalidate?: boolean;
}

export async function resolveAsyncValue<T>(
  cache: ResolverCache,
  key: string,
  resolver: AsyncResolver<T>,
  deps: Record<string, unknown>,
  opts: ResolveOptions = {},
): Promise<T> {
  if (!opts.invalidate) {
    const existing = cache.get(key) as ResolvedEntry<T> | undefined;
    if (existing) {
      if (existing.status === 'success') {
        return existing.value;
      }
      if (existing.status === 'error') {
        throw existing.error;
      }
      if (existing.status === 'pending') {
        return existing.promise;
      }
    }
  }

  const token = (cache.get(key)?.token ?? -1) + 1;
  const promise = (async () => {
    try {
      const value = await resolver.fn(deps);
      const current = cache.get(key);
      if (current?.token !== token) {
        throw new StaleResolutionError();
      }
      cache.set(key, { status: 'success', value, token });
      return value;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const current = cache.get(key);
      if (current?.token !== token) {
        throw new StaleResolutionError();
      }
      if (error.name === 'StaleResolutionError') {
        throw error;
      }
      cache.set(key, { status: 'error', error, token });
      throw error;
    }
  })();

  cache.set(key, { status: 'pending', promise, token });
  return promise;
}
