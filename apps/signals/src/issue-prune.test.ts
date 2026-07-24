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

it('does not touch another app\'s issues or signals', async () => {
  const { appId: appAId } = await seed();

  // App B: its own issue "widget-broke" with 2 signals, entirely separate from app A.
  const app = buildApp({ db: testDb });
  const b = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'B' } })).json();
  const errB = (session: string) => ({
    kind: 'error', sessionId: session, name: 'RangeError', message: 'widget-broke',
    mechanism: 'uncaught-exception', level: 'error', timestamp: new Date().toISOString(),
    stack: [{ functionName: 'g', file: 'src/b.ts', line: 1, column: 1, inApp: true }],
    platform: { runtime: 'browser' }, sdk: { name: 't', version: '0' },
  });
  await app.inject({ method: 'POST', url: `/ingest/${b.ingestKey}`, payload: { signals: [errB('bs1'), errB('bs2')] } });
  await app.close();

  const bIssueBefore = (await testDb.select().from(issues).where(eq(issues.appId, b.id)))[0]!;
  const bSignalsBefore = await testDb.select().from(signals).where(eq(signals.appId, b.id));
  expect(bSignalsBefore).toHaveLength(2);

  // Mirror the destructive scenario from the first test, but scoped to app A only.
  const aIssues = await testDb.select().from(issues).where(eq(issues.appId, appAId));
  const otherIssue = aIssues.find((i) => i.title.includes('other'))!;
  await testDb.delete(signals).where(eq(signals.issueId, otherIssue.id));
  await testDb.transaction((tx) => pruneIssues(tx, appAId));

  // App B's issue row is byte-for-byte the same, and its signals are untouched.
  const bIssueAfter = (await testDb.select().from(issues).where(eq(issues.id, bIssueBefore.id)))[0];
  expect(bIssueAfter).toBeDefined();
  expect(bIssueAfter!.eventCount).toBe(bIssueBefore.eventCount);
  expect(bIssueAfter!.firstSeen.getTime()).toBe(bIssueBefore.firstSeen.getTime());
  expect(bIssueAfter!.lastSeen.getTime()).toBe(bIssueBefore.lastSeen.getTime());
  const bSignalsAfter = await testDb.select().from(signals).where(eq(signals.appId, b.id));
  expect(bSignalsAfter).toHaveLength(2);
  expect(bSignalsAfter.map((s) => s.id).sort()).toEqual(bSignalsBefore.map((s) => s.id).sort());
});
