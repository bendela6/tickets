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

it('captures a genuine 500 with mechanism middleware + http context, but never an HttpError', async () => {
  const signals = fakeSignalsClient();
  const app = buildApp({ db: testDb, signals });
  app.get('/__test/throws', async () => {
    throw new Error('boom');
  });
  app.get('/__test/http-error', async () => {
    throw new HttpError(404, 'nope');
  });

  const throwRes = await app.inject({ method: 'GET', url: '/__test/throws' });
  expect(throwRes.statusCode).toBe(500);
  expect(signals.captureError).toHaveBeenCalledTimes(1);
  expect(signals.captureError).toHaveBeenCalledWith(expect.any(Error), {
    mechanism: 'middleware',
    contexts: { http: { method: 'GET', url: '/__test/throws' } },
  });

  const httpErrorRes = await app.inject({ method: 'GET', url: '/__test/http-error' });
  expect(httpErrorRes.statusCode).toBe(404);
  // HttpError (expected client-facing error) must NOT be captured — call count unchanged
  expect(signals.captureError).toHaveBeenCalledTimes(1);

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
