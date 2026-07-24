import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from './app';
import { issues, signals } from './db/schema';
import { pruneIssues } from './issue-prune';
import { resetDb, testDb } from './test/db';

beforeEach(resetDb);
afterAll(resetDb);

async function seed() {
  const app = buildApp({ db: testDb });
  const a = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'A' } })).json();
  const send = (payload: object) => app.inject({ method: 'POST', url: `/ingest/${a.ingestKey}`, payload });
  const err = (session: string, message: string) => ({
    kind: 'error', sessionId: session, name: 'TypeError', message,
    mechanism: 'uncaught-exception', level: 'error', timestamp: new Date().toISOString(),
    stack: [{ functionName: 'f', file: 'src/a.ts', line: 1, column: 1, inApp: true }],
    platform: { runtime: 'browser' }, sdk: { name: 't', version: '0' },
  });
  // Issue "boom": 3 signals. Issue "other": 2 signals.
  await send({ signals: [err('s1', 'boom'), err('s2', 'boom'), err('s3', 'boom')] });
  await send({ signals: [err('s1', 'other'), err('s2', 'other')] });
  await app.close();
  return { appId: a.id as number };
}

it('deletes issues with no remaining signals and recomputes survivors', async () => {
  const { appId } = await seed();
  const seededIssues = await testDb.select().from(issues).where(eq(issues.appId, appId));
  expect(seededIssues).toHaveLength(2);
  const boomIssue = seededIssues.find((i) => i.title.includes('boom'))!;
  const otherIssue = seededIssues.find((i) => i.title.includes('other'))!;

  // Simulate an upstream delete: wipe all of "other"'s signals, and one of "boom"'s three.
  await testDb.delete(signals).where(eq(signals.issueId, otherIssue.id));
  const boomSignals = await testDb.select().from(signals).where(eq(signals.issueId, boomIssue.id));
  await testDb.delete(signals).where(eq(signals.id, boomSignals[0]!.id));

  const result = await testDb.transaction((tx) => pruneIssues(tx, appId));
  expect(result.prunedIssues).toBe(1);

  const remaining = await testDb.select().from(issues).where(eq(issues.appId, appId));
  expect(remaining).toHaveLength(1);
  expect(remaining[0]!.id).toBe(boomIssue.id);
  expect(remaining[0]!.eventCount).toBe(2);

  const survivingSignals = await testDb.select().from(signals).where(eq(signals.issueId, boomIssue.id));
  expect(survivingSignals).toHaveLength(2);
  const receivedTimes = survivingSignals.map((s) => s.receivedAt.getTime()).sort((a, b) => a - b);
  expect(remaining[0]!.firstSeen.getTime()).toBe(receivedTimes[0]);
  expect(remaining[0]!.lastSeen.getTime()).toBe(receivedTimes[receivedTimes.length - 1]);
});

it('is a no-op when every issue still has referencing signals', async () => {
  const { appId } = await seed();
  const before = await testDb.select().from(issues).where(eq(issues.appId, appId));
  const result = await testDb.transaction((tx) => pruneIssues(tx, appId));
  expect(result.prunedIssues).toBe(0);
  const after = await testDb.select().from(issues).where(eq(issues.appId, appId));
  expect(after).toHaveLength(before.length);
});
