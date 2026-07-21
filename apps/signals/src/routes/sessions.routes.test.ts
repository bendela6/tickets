import { afterAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../app';
import { resetDb, testDb } from '../test/db';

beforeEach(resetDb);
afterAll(resetDb);

it('returns the chronological timeline with derived header data', async () => {
  const app = buildApp({ db: testDb });
  const a = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  const base = Date.parse('2026-07-21T14:02:11Z');
  const at = (s: number) => new Date(base + s * 1000).toISOString();
  const common = { sessionId: 'sess_9f3k21', platform: { runtime: 'browser' }, sdk: { name: 't', version: '0' } };
  await app.inject({
    method: 'POST', url: `/ingest/${a.ingestKey}`,
    payload: { signals: [
      { ...common, kind: 'event', name: 'page load', mechanism: 'manual', level: 'info', timestamp: at(0), release: '1.44.1' },
      { ...common, kind: 'log', name: 'console', message: 'cart hydrate', mechanism: 'console', level: 'info', timestamp: at(10) },
      { ...common, kind: 'error', name: 'TypeError', message: 'boom', mechanism: 'uncaught-exception', level: 'error', timestamp: at(20),
        stack: [{ functionName: 'f', file: 'src/a.ts', line: 1, column: 1, inApp: true }] },
    ] },
  });

  const res = await app.inject({ method: 'GET', url: '/sessions/sess_9f3k21/signals' });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.rows.map((r: { kind: string }) => r.kind)).toEqual(['event', 'log', 'error']);
  expect(body.session.crashed).toBe(true);
  expect(body.session.durationMs).toBe(20_000);
  expect(body.session.counts).toEqual({ error: 1, log: 1, event: 1 });
  expect(body.session.release).toBe('1.44.1');
  expect(body.rows[2].issueKey).toMatch(/^SGL-\d+$/);

  expect((await app.inject({ method: 'GET', url: '/sessions/nope/signals' })).statusCode).toBe(404);
  await app.close();
});

it('GET /sessions/:sessionId/signals?app= rejects a malformed app id with 400', async () => {
  const app = buildApp({ db: testDb });
  const res = await app.inject({ method: 'GET', url: '/sessions/whatever/signals?app=abc' });
  expect(res.statusCode).toBe(400);
  await app.close();
});
