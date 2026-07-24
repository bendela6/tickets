import { and, eq, lt } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../app';
import { issues, signals, sourcemapArtifacts } from '../db/schema';
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

it('does not touch another app\'s issues or signals', async () => {
  const { app, appId: appAId } = await seed();

  // App B: its own issue "widget-broke" with 2 signals, entirely separate from app A.
  const b = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'B' } })).json();
  const errB = (session: string) => ({
    kind: 'error', sessionId: session, name: 'RangeError', message: 'widget-broke',
    mechanism: 'uncaught-exception', level: 'error', timestamp: new Date().toISOString(),
    stack: [{ functionName: 'g', file: 'src/b.ts', line: 1, column: 1, inApp: true }],
    platform: { runtime: 'browser' }, sdk: { name: 't', version: '0' },
  });
  await app.inject({ method: 'POST', url: `/ingest/${b.ingestKey}`, payload: { signals: [errB('bs1'), errB('bs2')] } });

  const bIssueBefore = (await testDb.select().from(issues).where(eq(issues.appId, b.id)))[0]!;
  const bSignalsBefore = await testDb.select().from(signals).where(eq(signals.appId, b.id));
  expect(bSignalsBefore).toHaveLength(2);

  // No params -> deletes ALL of app A's signals and issues, the most destructive path.
  const res = await app.inject({ method: 'DELETE', url: `/apps/${appAId}/signals` });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.deletedSignals).toBe(6);
  expect(body.prunedIssues).toBe(2);
  expect(await testDb.select().from(issues).where(eq(issues.appId, appAId))).toHaveLength(0);

  // App B's issue row is byte-for-byte the same, and its signals are untouched by id.
  const bIssueAfter = (await testDb.select().from(issues).where(eq(issues.id, bIssueBefore.id)))[0];
  expect(bIssueAfter).toBeDefined();
  expect(bIssueAfter!.eventCount).toBe(bIssueBefore.eventCount);
  expect(bIssueAfter!.firstSeen.getTime()).toBe(bIssueBefore.firstSeen.getTime());
  expect(bIssueAfter!.lastSeen.getTime()).toBe(bIssueBefore.lastSeen.getTime());
  const bSignalsAfter = await testDb.select().from(signals).where(eq(signals.appId, b.id));
  expect(bSignalsAfter).toHaveLength(2);
  expect(bSignalsAfter.map((s) => s.id).sort()).toEqual(bSignalsBefore.map((s) => s.id).sort());
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

// --- releases list + delete-release -----------------------------------

const RELEASE_A = '1.44.1 rc'; // has a space -> must round-trip through URL-encoding
const RELEASE_B = '2.0.0';
const RELEASE_C = 'maps-only'; // sourcemap artifacts only, no signals at all

async function seedReleases() {
  const app = buildApp({ db: testDb });
  const a = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'ReleasesApp' } })).json();
  const other = (await app.inject({ method: 'POST', url: '/apps', payload: { name: 'OtherApp' } })).json();
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

  // App A / RELEASE_A: 2 errors (same fingerprint "boom") + 1 log + 2 sourcemap artifacts.
  await app.inject({
    method: 'POST', url: `/ingest/${a.ingestKey}`,
    payload: { signals: [err('s1', 'boom', RELEASE_A), err('s2', 'boom', RELEASE_A), log('s1', RELEASE_A)] },
  });
  await app.inject({
    method: 'POST', url: `/ingest/${a.ingestKey}/sourcemaps`,
    payload: {
      release: RELEASE_A,
      files: [
        { filename: 'a.js.map', content: 'x'.repeat(10) }, // 10 bytes
        { filename: 'b.js.map', content: 'y'.repeat(20) }, // 20 bytes -> 30 total
      ],
    },
  });

  // App A / RELEASE_B: signals only, no maps.
  await app.inject({ method: 'POST', url: `/ingest/${a.ingestKey}`, payload: { signals: [log('s2', RELEASE_B)] } });
  // Push it 1h into the future so newest-first ordering is deterministic.
  await testDb.update(signals)
    .set({ receivedAt: new Date(Date.now() + 60 * 60 * 1000) })
    .where(eq(signals.release, RELEASE_B));

  // App A / RELEASE_C: sourcemap artifacts only, no signals at all -> still shows up (union), null seen dates.
  await app.inject({
    method: 'POST', url: `/ingest/${a.ingestKey}/sourcemaps`,
    payload: { release: RELEASE_C, files: [{ filename: 'c.js.map', content: 'z'.repeat(5) }] },
  });

  // App B (other): its own signal under the SAME release-A name — must never leak into app A's rows/deletes.
  await app.inject({
    method: 'POST', url: `/ingest/${other.ingestKey}`,
    payload: { signals: [err('os1', 'other-boom', RELEASE_A)] },
  });

  return { app, appId: a.id as number, otherAppId: other.id as number };
}

it('GET /apps/:id/releases unions signals and sourcemap releases, with correct counts/bytes, newest-first, scoped to the app', async () => {
  const { app, appId, otherAppId } = await seedReleases();
  const res = await app.inject({ method: 'GET', url: `/apps/${appId}/releases` });
  expect(res.statusCode).toBe(200);
  const rows = res.json();
  expect(rows).toHaveLength(3);

  // Newest-first: B (pushed 1h ahead) then A (just seeded) then C (no signals -> null lastSeen, sorts last).
  expect(rows.map((r: { release: string }) => r.release)).toEqual([RELEASE_B, RELEASE_A, RELEASE_C]);

  const [b, a, c] = rows;
  expect(b).toMatchObject({ signalCount: 1, errorCount: 0, sourcemapCount: 0, sourcemapBytes: 0 });
  expect(b.firstSeen).not.toBeNull();
  expect(b.lastSeen).not.toBeNull();

  // errorCount is 2, not 3 -> proves the other app's RELEASE_A error isn't counted in.
  expect(a).toMatchObject({ signalCount: 3, errorCount: 2, sourcemapCount: 2, sourcemapBytes: 30 });
  expect(a.firstSeen).not.toBeNull();
  expect(a.lastSeen).not.toBeNull();

  expect(c).toMatchObject({ signalCount: 0, errorCount: 0, sourcemapCount: 1, sourcemapBytes: 5 });
  expect(c.firstSeen).toBeNull();
  expect(c.lastSeen).toBeNull();

  // Scoped correctly the other way too: the other app sees only its own RELEASE_A.
  const otherRes = await app.inject({ method: 'GET', url: `/apps/${otherAppId}/releases` });
  const otherRows = otherRes.json();
  expect(otherRows).toHaveLength(1);
  expect(otherRows[0]).toMatchObject({ release: RELEASE_A, signalCount: 1, errorCount: 1, sourcemapCount: 0, sourcemapBytes: 0 });

  await app.close();
});

it('404s GET /apps/:id/releases for an unknown app', async () => {
  const { app } = await seedReleases();
  const res = await app.inject({ method: 'GET', url: '/apps/9999/releases' });
  expect(res.statusCode).toBe(404);
  await app.close();
});

it('DELETE /apps/:id/releases/:release url-decodes the release, deletes its signals+artifacts, prunes emptied issues, leaves other releases/apps untouched', async () => {
  const { app, appId, otherAppId } = await seedReleases();

  const res = await app.inject({
    method: 'DELETE',
    url: `/apps/${appId}/releases/${encodeURIComponent(RELEASE_A)}`,
  });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ deletedSignals: 3, deletedArtifacts: 2, prunedIssues: 1 });

  // RELEASE_A is fully gone for app A...
  expect(await testDb.select().from(signals)
    .where(and(eq(signals.appId, appId), eq(signals.release, RELEASE_A)))).toHaveLength(0);
  expect(await testDb.select().from(sourcemapArtifacts)
    .where(and(eq(sourcemapArtifacts.appId, appId), eq(sourcemapArtifacts.release, RELEASE_A)))).toHaveLength(0);
  // ...and the "boom" issue (only ever referenced RELEASE_A signals) was pruned.
  expect(await testDb.select().from(issues).where(eq(issues.appId, appId))).toHaveLength(0);

  // RELEASE_B's signal and RELEASE_C's artifact survive untouched.
  const remaining = (await app.inject({ method: 'GET', url: `/apps/${appId}/releases` })).json();
  expect(remaining.map((r: { release: string }) => r.release).sort()).toEqual([RELEASE_B, RELEASE_C].sort());

  // The other app's own RELEASE_A signal + issue are untouched.
  expect(await testDb.select().from(signals).where(eq(signals.appId, otherAppId))).toHaveLength(1);
  expect(await testDb.select().from(issues).where(eq(issues.appId, otherAppId))).toHaveLength(1);

  await app.close();
});

it('DELETE a release with no matches returns 200 with zero counts (valid app, nothing to delete)', async () => {
  const { app, appId } = await seedReleases();
  const res = await app.inject({
    method: 'DELETE',
    url: `/apps/${appId}/releases/${encodeURIComponent('nope-9.9.9')}`,
  });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ deletedSignals: 0, deletedArtifacts: 0, prunedIssues: 0 });
  await app.close();
});

it('404s DELETE /apps/:id/releases/:release for an unknown app', async () => {
  const { app } = await seedReleases();
  const res = await app.inject({
    method: 'DELETE',
    url: `/apps/9999/releases/${encodeURIComponent(RELEASE_A)}`,
  });
  expect(res.statusCode).toBe(404);
  await app.close();
});
