import { describe, expect, test, vi } from 'vitest';
import { createResolverCache } from './resolver-cache';
import { waitForResolutions, AsyncConfigTimeoutError } from './wait-for-resolutions';

describe('waitForResolutions timeout', () => {
  test('rejects with AsyncConfigTimeoutError when a visible resolver never settles', async () => {
    vi.useFakeTimers();
    try {
      const cache = createResolverCache();
      // Seed the cache with a pending entry whose key starts with a visible field name.
      const neverPromise = new Promise<unknown>(() => {});
      cache.set('country.options::{}', { status: 'pending', promise: neverPromise, token: 0 });

      const visible = new Set<string>(['country']);
      const promise = waitForResolutions(cache, visible, 100);

      // Advance timers in parallel with awaiting the rejection.
      await Promise.all([
        expect(promise).rejects.toBeInstanceOf(AsyncConfigTimeoutError),
        vi.advanceTimersByTimeAsync(150),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  test('resolves before timeout when no visible resolvers are pending', async () => {
    vi.useFakeTimers();
    try {
      const cache = createResolverCache();
      // Only a hidden-field resolver is pending; visible set excludes it.
      const neverPromise = new Promise<unknown>(() => {});
      cache.set('hidden.options::{}', { status: 'pending', promise: neverPromise, token: 0 });

      const visible = new Set<string>(['some-other-field']);
      await expect(waitForResolutions(cache, visible, 100)).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  test('clears the timeout timer when resolvers settle in time', async () => {
    vi.useFakeTimers();
    try {
      const cache = createResolverCache();
      let resolveIt!: (v: unknown) => void;
      const promise = new Promise<unknown>((res) => {
        resolveIt = res;
      });
      cache.set('country.options::{}', { status: 'pending', promise, token: 0 });

      const visible = new Set<string>(['country']);
      const waitPromise = waitForResolutions(cache, visible, 1000);

      // Settle the resolver before the timeout fires.
      resolveIt('done');
      await expect(waitPromise).resolves.toBeUndefined();

      // Advance past the original timeout — should not fire any error since the timer was cleared.
      await vi.advanceTimersByTimeAsync(2000);
    } finally {
      vi.useRealTimers();
    }
  });
});
