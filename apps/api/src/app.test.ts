import { expect, it, vi } from 'vitest';
import type { SignalsClient } from '@bendela6/signals-node';
import { HttpError } from './errors';
import { testDb } from './test/db';
import { buildApp } from './app';

function fakeSignalsClient(): SignalsClient {
  return {
    captureError: vi.fn(),
    captureEvent: vi.fn(),
    captureLog: vi.fn(),
    addBreadcrumb: vi.fn(),
    setUser: vi.fn(),
    setTag: vi.fn(),
    setContext: vi.fn(),
    flush: vi.fn(async () => {}),
    takeAll: vi.fn(() => []),
    sessionId: 'sess_test',
    enabled: true,
  };
}

it('captures a genuine 500 with level error, mechanism middleware + http context', async () => {
  const signals = fakeSignalsClient();
  const app = buildApp({ db: testDb, signals });
  app.get('/__test/throws', async () => {
    throw new Error('boom');
  });

  const throwRes = await app.inject({ method: 'GET', url: '/__test/throws' });
  expect(throwRes.statusCode).toBe(500);
  expect(signals.captureError).toHaveBeenCalledTimes(1);
  expect(signals.captureError).toHaveBeenCalledWith(expect.any(Error), {
    level: 'error',
    mechanism: 'middleware',
    contexts: { http: { method: 'GET', url: '/__test/throws', status: 500 } },
  });

  await app.close();
});

// v1 pinned "an HttpError is never captured" — that behavior is now inverted:
// handled 4xx errors ARE captured, just at warning level, so they stay
// visible in Signals without being confused with genuine server failures.
it('captures an HttpError (expected client error) at level warning, with its status in contexts', async () => {
  const signals = fakeSignalsClient();
  const app = buildApp({ db: testDb, signals });
  app.get('/__test/http-error', async () => {
    throw new HttpError(404, 'nope');
  });

  const httpErrorRes = await app.inject({ method: 'GET', url: '/__test/http-error' });
  expect(httpErrorRes.statusCode).toBe(404);
  expect(signals.captureError).toHaveBeenCalledTimes(1);
  expect(signals.captureError).toHaveBeenCalledWith(expect.any(Error), {
    level: 'warning',
    mechanism: 'middleware',
    fingerprint: 'http-404-GET-/__test/http-error',
    contexts: { http: { method: 'GET', url: '/__test/http-error', status: 404 } },
  });

  await app.close();
});

// ~19 throw sites interpolate a concrete identifier (item id, field key,
// provider name, ...) into the HttpError message. Fingerprinting on the
// message would explode into one Signals issue per identifier; fingerprinting
// on the matched ROUTE PATTERN (fastify's request.routeOptions.url) groups
// every "not found" for the same endpoint into a single issue regardless of
// which id 404'd.
it('two HttpErrors for different ids on the same route pattern share one fingerprint', async () => {
  const signals = fakeSignalsClient();
  const app = buildApp({ db: testDb, signals });
  app.get('/__test/items/:id', async (request) => {
    const { id } = request.params as { id: string };
    throw new HttpError(404, `item ${id} not found`);
  });

  const res17 = await app.inject({ method: 'GET', url: '/__test/items/17' });
  const res18 = await app.inject({ method: 'GET', url: '/__test/items/18' });
  expect(res17.statusCode).toBe(404);
  expect(res18.statusCode).toBe(404);
  expect(signals.captureError).toHaveBeenCalledTimes(2);

  const calls = (signals.captureError as ReturnType<typeof vi.fn>).mock.calls;
  const fp17 = (calls[0]![1] as { fingerprint?: string }).fingerprint;
  const fp18 = (calls[1]![1] as { fingerprint?: string }).fingerprint;
  expect(fp17).toBe('http-404-GET-/__test/items/:id');
  expect(fp17).toBe(fp18); // same route pattern → same issue, despite different messages/ids

  await app.close();
});

it('an unmatched route is captured with a single stable fingerprint shared by every unmatched path', async () => {
  const signals = fakeSignalsClient();
  const app = buildApp({ db: testDb, signals });

  const res1 = await app.inject({ method: 'GET', url: '/__test/does-not-exist' });
  const res2 = await app.inject({ method: 'GET', url: '/__test/also-missing' });
  expect(res1.statusCode).toBe(404);
  expect(res1.json()).toEqual({ error: 'not found' });
  expect(res2.statusCode).toBe(404);

  expect(signals.captureError).toHaveBeenCalledTimes(2);
  expect(signals.captureError).toHaveBeenNthCalledWith(1, expect.any(Error), {
    level: 'warning',
    mechanism: 'middleware',
    fingerprint: 'http-404-unmatched',
    contexts: { http: { method: 'GET', url: '/__test/does-not-exist', status: 404 } },
  });
  expect(signals.captureError).toHaveBeenNthCalledWith(2, expect.any(Error), {
    level: 'warning',
    mechanism: 'middleware',
    fingerprint: 'http-404-unmatched',
    contexts: { http: { method: 'GET', url: '/__test/also-missing', status: 404 } },
  });

  await app.close();
});

it('works unchanged when no signals client is injected', async () => {
  const app = buildApp({ db: testDb });
  app.get('/__test/throws-no-signals', async () => {
    throw new Error('boom');
  });
  const res = await app.inject({ method: 'GET', url: '/__test/throws-no-signals' });
  expect(res.statusCode).toBe(500);

  const notFoundRes = await app.inject({ method: 'GET', url: '/__test/missing-no-signals' });
  expect(notFoundRes.statusCode).toBe(404);

  await app.close();
});
