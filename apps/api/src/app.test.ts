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
    contexts: { http: { method: 'GET', url: '/__test/http-error', status: 404 } },
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
  await app.close();
});
