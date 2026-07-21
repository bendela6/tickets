import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app';
import { issues, signals } from '../db/schema';
import { createRateLimiter } from '../rate-limit';
import { resetDb, testDb } from '../test/db';

beforeEach(resetDb);
afterAll(resetDb);

async function makeApp() {
  const app = buildApp({ db: testDb });
  const created = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  return { app, key: created.ingestKey as string, appId: created.id as number };
}

const errorSignal = (overrides: Record<string, unknown> = {}) => ({
  kind: 'error', sessionId: 'sess_1', name: 'TypeError',
  message: "Cannot read properties of undefined (reading 'map')",
  mechanism: 'uncaught-exception', level: 'error',
  timestamp: new Date().toISOString(),
  stack: [{ functionName: 'CartList', file: 'src/checkout/CartList.tsx', line: 48, column: 13, inApp: true }],
  platform: { runtime: 'browser' }, sdk: { name: 'test', version: '0.0.0' },
  ...overrides,
});

it('rejects unknown keys with 403 and invalid envelopes with 400', async () => {
  const { app, key } = await makeApp();
  expect((await app.inject({ method: 'POST', url: '/ingest/pub_nope', payload: { signals: [errorSignal()] } })).statusCode).toBe(403);
  expect((await app.inject({ method: 'POST', url: `/ingest/${key}`, payload: { nope: true } })).statusCode).toBe(400);
  await app.close();
});

it('accepts a batch, creates an issue for the error, and groups repeats', async () => {
  const { app, key, appId } = await makeApp();
  const first = await app.inject({ method: 'POST', url: `/ingest/${key}`, payload: { signals: [errorSignal()] } });
  expect(first.statusCode).toBe(202);
  expect(first.json()).toEqual({ accepted: 1 });
  await app.inject({ method: 'POST', url: `/ingest/${key}`, payload: { signals: [errorSignal({ sessionId: 'sess_2' })] } });

  const issueRows = await testDb.select().from(issues);
  expect(issueRows).toHaveLength(1);
  expect(issueRows[0]!.eventCount).toBe(2);
  expect(issueRows[0]!.culprit).toBe('src/checkout/CartList.tsx:48');
  expect(issueRows[0]!.appId).toBe(appId);

  const signalRows = await testDb.select().from(signals).where(eq(signals.issueId, issueRows[0]!.id));
  expect(signalRows).toHaveLength(2);
  await app.close();
});

it('log/event kinds never create issues', async () => {
  const { app, key } = await makeApp();
  await app.inject({
    method: 'POST', url: `/ingest/${key}`,
    payload: { signals: [
      { kind: 'log', sessionId: 's', name: 'console', message: 'hello', mechanism: 'console', level: 'info',
        timestamp: new Date().toISOString(), platform: { runtime: 'node' }, sdk: { name: 't', version: '0' } },
      { kind: 'event', sessionId: 's', name: 'checkout.started', mechanism: 'manual', level: 'info',
        timestamp: new Date().toISOString(), platform: { runtime: 'node' }, sdk: { name: 't', version: '0' } },
    ] },
  });
  expect(await testDb.select().from(issues)).toHaveLength(0);
  expect(await testDb.select().from(signals)).toHaveLength(2);
  await app.close();
});

it('reopens a resolved issue on regression but leaves ignored alone', async () => {
  const { app, key } = await makeApp();
  await app.inject({ method: 'POST', url: `/ingest/${key}`, payload: { signals: [errorSignal()] } });
  let [issue] = await testDb.select().from(issues);
  await testDb.update(issues).set({ status: 'resolved' }).where(eq(issues.id, issue!.id));
  await app.inject({ method: 'POST', url: `/ingest/${key}`, payload: { signals: [errorSignal()] } });
  [issue] = await testDb.select().from(issues);
  expect(issue!.status).toBe('open');
  expect(issue!.eventCount).toBe(2);

  await testDb.update(issues).set({ status: 'ignored' }).where(eq(issues.id, issue!.id));
  await app.inject({ method: 'POST', url: `/ingest/${key}`, payload: { signals: [errorSignal()] } });
  [issue] = await testDb.select().from(issues);
  expect(issue!.status).toBe('ignored');
  expect(issue!.eventCount).toBe(3);
  await app.close();
});

it('enforces the per-key rate limit with 429', async () => {
  let t = 0;
  const app = buildApp({ db: testDb, rateLimiter: createRateLimiter({ limit: 2, windowMs: 60_000, now: () => t }) });
  const created = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'B' } })).json();
  const one = { signals: [errorSignal()] };
  expect((await app.inject({ method: 'POST', url: `/ingest/${created.ingestKey}`, payload: one })).statusCode).toBe(202);
  expect((await app.inject({ method: 'POST', url: `/ingest/${created.ingestKey}`, payload: one })).statusCode).toBe(202);
  expect((await app.inject({ method: 'POST', url: `/ingest/${created.ingestKey}`, payload: one })).statusCode).toBe(429);
  await app.close();
});

it('answers ingest CORS preflight with open headers', async () => {
  const { app, key } = await makeApp();
  const res = await app.inject({ method: 'OPTIONS', url: `/ingest/${key}` });
  expect(res.statusCode).toBe(204);
  expect(res.headers['access-control-allow-origin']).toBe('*');
  await app.close();
});
