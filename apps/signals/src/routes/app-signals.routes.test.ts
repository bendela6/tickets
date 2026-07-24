import { eq, lt } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../app';
import { issues, signals } from '../db/schema';
import { resetDb, testDb } from '../test/db';

beforeEach(resetDb);
afterAll(resetDb);

async function seed() {
  const app = buildApp({ db: testDb });
  const a = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  const send = (payload: object) => app.inject({ method: 'POST', url: `/ingest/${a.ingestKey}`, payload });
  const err = (session: string, message: string, release: string) => ({
    kind: 'error', sessionId: session, name: 'TypeError', message,
    mechanism: 'uncaught-exception', level: 'error', timestamp: new Date().toISOString(), release,
    stack: [{ functionName: 'f', file: 'src/a.ts', line: 1, column: 1, inApp: true }],
    platform: { runtime: 'browser' }, sdk: { name: 't', version: '0' },
  });
  const log = (session: string, release: string) => ({
    kind: 'log', sessionId: session, name: 'info', message: 'hello',
    mechanism: 'manual', level: 'info', timestamp: new Date().toISOString(), release,
    platform: { runtime: 'browser' }, sdk: { name: 't', version: '0' },
  });
  // Issue "boom": 2 signals @1.0.0, 1 signal @2.0.0 (total 3, same fingerprint across releases).
  await send({ signals: [err('s1', 'boom', '1.0.0'), err('s2', 'boom', '1.0.0'), err('s3', 'boom', '2.0.0')] });
  // Issue "other": 1 signal @1.0.0 only.
  await send({ signals: [err('s4', 'other', '1.0.0')] });
  // Non-error logs, not tied to any issue: 1 @1.0.0, 1 @2.0.0.
  await send({ signals: [log('s1', '1.0.0'), log('s3', '2.0.0')] });
  return { app, appId: a.id as number };
}

it('release filter deletes only that release\'s signals and prunes the emptied issue', async () => {
  const { app, appId } = await seed();
  const res = await app.inject({ method: 'DELETE', url: `/apps/${appId}/signals?release=1.0.0` });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  // boom@1.0.0 x2 + other@1.0.0 x1 + log@1.0.0 x1 = 4
  expect(body.deletedSignals).toBe(4);
  // "other" issue had only a 1.0.0 signal -> pruned.
  expect(body.prunedIssues).toBe(1);

  const remainingIssues = await testDb.select().from(issues).where(eq(issues.appId, appId));
  expect(remainingIssues).toHaveLength(1);
  expect(remainingIssues[0]!.title).toContain('boom');
  expect(remainingIssues[0]!.eventCount).toBe(1);

  const remainingSignals = await testDb.select().from(signals).where(eq(signals.appId, appId));
  expect(remainingSignals).toHaveLength(2); // boom@2.0.0 + log@2.0.0
  await app.close();
});

it('before filter deletes only older signals', async () => {
  const { app, appId } = await seed();
  // Age the two boom@1.0.0 signals so they fall before the cutoff; everything else stays "now".
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const boomSignals = await testDb.select().from(signals).where(eq(signals.release, '1.0.0'));
  const boomOnly = boomSignals.filter((s) => s.kind === 'error' && s.message === 'boom');
  for (const s of boomOnly) {
    await testDb.update(signals).set({ receivedAt: old }).where(eq(signals.id, s.id));
  }

  const res = await app.inject({ method: 'DELETE', url: `/apps/${appId}/signals?before=${cutoff.toISOString()}` });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.deletedSignals).toBe(2);
  // boom issue still has its @2.0.0 signal -> survives, recomputed to 1.
  expect(body.prunedIssues).toBe(0);

  const remainingIssues = await testDb.select().from(issues).where(eq(issues.appId, appId));
  expect(remainingIssues).toHaveLength(2);
  const boomIssue = remainingIssues.find((i) => i.title.includes('boom'))!;
  expect(boomIssue.eventCount).toBe(1);
  const otherIssue = remainingIssues.find((i) => i.title.includes('other'))!;
  expect(otherIssue.eventCount).toBe(1);

  const stillOld = await testDb.select().from(signals).where(lt(signals.receivedAt, cutoff));
  expect(stillOld).toHaveLength(0);
  await app.close();
});

it('no params deletes all of the app\'s signals and issues', async () => {
  const { app, appId } = await seed();
  const res = await app.inject({ method: 'DELETE', url: `/apps/${appId}/signals` });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.deletedSignals).toBe(6);
  expect(body.prunedIssues).toBe(2);

  expect(await testDb.select().from(issues).where(eq(issues.appId, appId))).toHaveLength(0);
  expect(await testDb.select().from(signals).where(eq(signals.appId, appId))).toHaveLength(0);
  await app.close();
});

it('kind filter deletes only that kind', async () => {
  const { app, appId } = await seed();
  const res = await app.inject({ method: 'DELETE', url: `/apps/${appId}/signals?kind=log` });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.deletedSignals).toBe(2);
  expect(body.prunedIssues).toBe(0); // logs don't reference issues
  const remainingSignals = await testDb.select().from(signals).where(eq(signals.appId, appId));
  expect(remainingSignals.every((s) => s.kind === 'error')).toBe(true);
  await app.close();
});

it('404s for an unknown app id', async () => {
  const { app } = await seed();
  const res = await app.inject({ method: 'DELETE', url: '/apps/9999/signals' });
  expect(res.statusCode).toBe(404);
  await app.close();
});

it('rejects a malformed app id with 400', async () => {
  const { app } = await seed();
  const res = await app.inject({ method: 'DELETE', url: '/apps/abc/signals' });
  expect(res.statusCode).toBe(400);
  await app.close();
});
