import { afterAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../app';
import { resetDb, testDb } from '../test/db';

beforeEach(resetDb);
afterAll(resetDb);

async function seed() {
  const app = buildApp({ db: testDb });
  const a = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  const send = (payload: object) =>
    app.inject({ method: 'POST', url: `/ingest/${a.ingestKey}`, payload });
  const err = (session: string, message: string, release?: string, user?: object) => ({
    kind: 'error', sessionId: session, name: 'TypeError', message,
    mechanism: 'uncaught-exception', level: 'error', timestamp: new Date().toISOString(),
    release, user,
    stack: [{ functionName: 'f', file: 'src/a.ts', line: 1, column: 1, inApp: true }],
    platform: { runtime: 'browser' }, sdk: { name: 't', version: '0' },
  });
  await send({ signals: [err('s1', 'boom', '1.0.0', { id: 'u1' })] });
  await send({ signals: [err('s2', 'boom', '1.1.0', { id: 'u2' })] });
  await send({ signals: [err('s1', 'different failure entirely')] });
  return { app, appId: a.id as number };
}

it('lists issues with keys, counts, and a 14-slot sparkline', async () => {
  const { app } = await seed();
  const body = (await app.inject({ method: 'GET', url: '/issues' })).json();
  expect(body.total).toBe(2);
  const grouped = body.rows.find((r: { eventCount: number }) => r.eventCount === 2);
  expect(grouped.key).toMatch(/^SGL-\d+$/);
  expect(grouped.spark).toHaveLength(14);
  expect(grouped.spark[13]).toBe(2); // both events today
  expect(grouped.level).toBe('error');
  await app.close();
});

it('filters by status and text', async () => {
  const { app } = await seed();
  const q = (url: string) => app.inject({ method: 'GET', url }).then((r) => r.json());
  expect((await q('/issues?status=resolved')).total).toBe(0);
  expect((await q('/issues?q=different')).total).toBe(1);
  await app.close();
});

it('issue detail carries session/user counts and release range', async () => {
  const { app } = await seed();
  const list = (await app.inject({ method: 'GET', url: '/issues?q=boom' })).json();
  const detail = (await app.inject({ method: 'GET', url: `/issues/${list.rows[0].id}` })).json();
  expect(detail.sessionCount).toBe(2);
  expect(detail.userCount).toBe(2);
  expect(detail.releaseRange).toEqual({ first: '1.0.0', last: '1.1.0' });
  await app.close();
});

it('PATCH updates status and rejects bad values; occurrences paginate', async () => {
  const { app } = await seed();
  const list = (await app.inject({ method: 'GET', url: '/issues?q=boom' })).json();
  const id = list.rows[0].id;
  const patched = (await app.inject({ method: 'PATCH', url: `/issues/${id}`, payload: { status: 'resolved' } })).json();
  expect(patched.status).toBe('resolved');
  expect((await app.inject({ method: 'PATCH', url: `/issues/${id}`, payload: { status: 'nope' } })).statusCode).toBe(400);
  const occ = (await app.inject({ method: 'GET', url: `/issues/${id}/signals?perPage=1&page=2` })).json();
  expect(occ.total).toBe(2);
  expect(occ.rows).toHaveLength(1);
  expect(occ.rows[0].sessionId).toBeDefined();
  await app.close();
});

it('issue detail includes appSlug, level, and mechanism from the newest signal', async () => {
  const { app } = await seed();
  const list = (await app.inject({ method: 'GET', url: '/issues?q=boom' })).json();
  const detail = (await app.inject({ method: 'GET', url: `/issues/${list.rows[0].id}` })).json();
  expect(detail.appSlug).toBeDefined();
  expect(detail.level).toBe('error');
  expect(detail.mechanism).toBe('uncaught-exception');
  await app.close();
});

it('PATCH response includes appSlug, level, and mechanism from the newest signal', async () => {
  const { app } = await seed();
  const list = (await app.inject({ method: 'GET', url: '/issues?q=boom' })).json();
  const id = list.rows[0].id;
  const patched = (await app.inject({ method: 'PATCH', url: `/issues/${id}`, payload: { status: 'resolved' } })).json();
  expect(patched.appSlug).toBeDefined();
  expect(patched.level).toBe('error');
  expect(patched.mechanism).toBe('uncaught-exception');
  await app.close();
});
