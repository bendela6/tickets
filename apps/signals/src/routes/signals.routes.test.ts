import { afterAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../app';
import { resetDb, testDb } from '../test/db';

beforeEach(resetDb);
afterAll(resetDb);

async function seed() {
  const app = buildApp({ db: testDb });
  const a = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  const b = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'B' } })).json();
  const send = (ingestKey: string, payload: object) =>
    app.inject({ method: 'POST', url: `/ingest/${ingestKey}`, payload });

  const sig = (overrides: Partial<{
    kind: 'error' | 'log' | 'event'; sessionId: string; name: string; message: string;
    mechanism: string; level: string;
  }>) => ({
    kind: 'log', sessionId: 's1', name: 'evt', message: 'msg',
    mechanism: 'console', level: 'info', timestamp: new Date().toISOString(),
    platform: { runtime: 'browser' }, sdk: { name: 't', version: '0' },
    ...overrides,
  });

  // App A: 2 logs, 1 event, 1 error (error must be excluded from /signals)
  await send(a.ingestKey, { signals: [sig({ kind: 'log', sessionId: 's1', name: 'request', message: 'GET /foo' })] });
  await send(a.ingestKey, { signals: [sig({ kind: 'log', sessionId: 's1', name: 'request', message: 'GET /bar' })] });
  await send(a.ingestKey, { signals: [sig({ kind: 'event', sessionId: 's1', name: 'click', message: 'button clicked' })] });
  await send(a.ingestKey, {
    signals: [sig({ kind: 'error', sessionId: 's1', name: 'TypeError', message: 'boom', mechanism: 'uncaught-exception', level: 'error' })],
  });

  // App B: 1 log, 1 event
  await send(b.ingestKey, { signals: [sig({ kind: 'log', sessionId: 's2', name: 'special-log', message: 'needle here' })] });
  await send(b.ingestKey, { signals: [sig({ kind: 'event', sessionId: 's2', name: 'pageview', message: 'home page' })] });

  return { app, appA: a as { id: number; ingestKey: string }, appB: b as { id: number; ingestKey: string } };
}

it('lists non-error signals newest-first with appSlug, excluding errors', async () => {
  const { app } = await seed();
  const body = (await app.inject({ method: 'GET', url: '/signals' })).json();
  expect(body.total).toBe(5);
  expect(body.rows).toHaveLength(5);
  expect(body.rows.every((r: { kind: string }) => r.kind !== 'error')).toBe(true);
  expect(body.rows.every((r: { appSlug: string | undefined }) => r.appSlug)).toBe(true);

  const receivedTimes = body.rows.map((r: { receivedAt: string }) => new Date(r.receivedAt).getTime());
  const sorted = [...receivedTimes].sort((x, y) => y - x);
  expect(receivedTimes).toEqual(sorted);
  await app.close();
});

it('filters by kind', async () => {
  const { app } = await seed();
  const body = (await app.inject({ method: 'GET', url: '/signals?kind=event' })).json();
  expect(body.total).toBe(2);
  expect(body.rows.every((r: { kind: string }) => r.kind === 'event')).toBe(true);
  await app.close();
});

it('ignores kind=error, returning nothing', async () => {
  const { app } = await seed();
  const body = (await app.inject({ method: 'GET', url: '/signals?kind=error' })).json();
  expect(body.total).toBe(0);
  expect(body.rows).toHaveLength(0);
  await app.close();
});

it('filters by app', async () => {
  const { app, appA } = await seed();
  const body = (await app.inject({ method: 'GET', url: `/signals?app=${appA.id}` })).json();
  expect(body.total).toBe(3);
  expect(body.rows.every((r: { appId: number }) => r.appId === appA.id)).toBe(true);
  await app.close();
});

it('filters by q against name or message', async () => {
  const { app } = await seed();
  const body = (await app.inject({ method: 'GET', url: '/signals?q=needle' })).json();
  expect(body.total).toBe(1);
  expect(body.rows[0].message).toBe('needle here');
  await app.close();
});

it('paginates with a correct total', async () => {
  const { app } = await seed();
  const body = (await app.inject({ method: 'GET', url: '/signals?perPage=2&page=1' })).json();
  expect(body.total).toBe(5);
  expect(body.rows).toHaveLength(2);
  const page2 = (await app.inject({ method: 'GET', url: '/signals?perPage=2&page=2' })).json();
  expect(page2.rows).toHaveLength(2);
  await app.close();
});
