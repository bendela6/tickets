import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createResolverCache } from './resolver-cache';
import { resolveAsyncValue } from './resolve-async-value';

describe('resolveAsyncValue', () => {
  let cache = createResolverCache();
  beforeEach(() => {
    cache = createResolverCache();
  });

  test('cache miss: fetches, stores, returns value', async () => {
    const fn = vi.fn().mockResolvedValue(['a', 'b']);
    const result = await resolveAsyncValue(cache, 'k1', { dependsOn: [], fn }, {});
    expect(result).toEqual(['a', 'b']);
    expect(fn).toHaveBeenCalledOnce();
  });

  test('cache hit success: does not refetch', async () => {
    const fn = vi.fn().mockResolvedValue(['a']);
    await resolveAsyncValue(cache, 'k1', { dependsOn: [], fn }, {});
    await resolveAsyncValue(cache, 'k1', { dependsOn: [], fn }, {});
    expect(fn).toHaveBeenCalledOnce();
  });

  test('cache hit pending: dedupes concurrent calls', async () => {
    const fn = vi.fn().mockReturnValue(new Promise((res) => setTimeout(() => res(['a']), 10)));
    const [a, b] = await Promise.all([
      resolveAsyncValue(cache, 'k1', { dependsOn: [], fn }, {}),
      resolveAsyncValue(cache, 'k1', { dependsOn: [], fn }, {}),
    ]);
    expect(a).toEqual(['a']);
    expect(b).toEqual(['a']);
    expect(fn).toHaveBeenCalledOnce();
  });

  test('error path: stores error, surfaces it, does not retry on next call', async () => {
    const err = new Error('boom');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(resolveAsyncValue(cache, 'k1', { dependsOn: [], fn }, {})).rejects.toThrow('boom');
    await expect(resolveAsyncValue(cache, 'k1', { dependsOn: [], fn }, {})).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledOnce();
  });

  test('race-token: stale resolution does not overwrite a fresher token under the same key', async () => {
    let resolveFirst!: (v: string[]) => void;
    let resolveSecond!: (v: string[]) => void;
    const fn1 = vi.fn(() => {
      return new Promise<string[]>((res) => {
        resolveFirst = res;
      });
    });
    const fn2 = vi.fn(() => {
      return new Promise<string[]>((res) => {
        resolveSecond = res;
      });
    });

    // First call (token 0)
    const p1 = resolveAsyncValue(cache, 'k1', { dependsOn: [], fn: fn1 }, {}, { invalidate: true });
    // Invalidate and start a new resolution (token 1)
    const p2 = resolveAsyncValue(cache, 'k1', { dependsOn: [], fn: fn2 }, {}, { invalidate: true });

    // Settle the SECOND first, then the first (stale).
    resolveSecond(['fresh']);
    await p2;
    resolveFirst(['stale']);
    await expect(p1).rejects.toMatchObject({ name: 'StaleResolutionError' });

    // Cache should hold the fresh value.
    const value = await resolveAsyncValue(cache, 'k1', { dependsOn: [], fn: fn1 }, {});
    expect(value).toEqual(['fresh']);
  });
});
