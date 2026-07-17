import { resolve } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import { environment, terminalSessions, workdirs } from '@tickets/db';
import { createTerminalStore } from './store';

// Real-Postgres test for the TerminalStore adapter — same scratch-db-per-run
// pattern as the rest of the api tests. Verifies the SQL for append/replay/
// prune/lifecycle against actual rows, so the driver's fake-store unit tests
// are trustworthy.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_terminal_store_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let store: ReturnType<typeof createTerminalStore>;
let sessionId: number;

beforeAll(async () => {
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  scratchSql = postgres(scratchUrl, { max: 1 });
  db = drizzle(scratchSql) as unknown as Db;
  await migrate(db, {
    migrationsFolder: resolve(import.meta.dirname, '../../../../packages/db/drizzle'),
  });

  const [wd] = await db
    .insert(workdirs)
    .values({ name: 'test-wd', path: '/tmp/wd' })
    .returning({ id: workdirs.id });
  const [session] = await db
    .insert(terminalSessions)
    .values({ title: 'test session', workdirId: wd!.id })
    .returning({ id: terminalSessions.id });
  sessionId = session!.id;
  store = createTerminalStore(db);
}, 30_000);

afterAll(async () => {
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

describe('TerminalStore', () => {
  test('appends frames and replays only those after a given seq, ascending', async () => {
    await store.append(sessionId, [
      { type: 'output', seq: 1, data: 'a' },
      { type: 'output', seq: 2, data: 'b' },
      { type: 'output', seq: 3, data: 'c' },
    ]);

    const all = await store.replay(sessionId, 0);
    expect(all.frames).toEqual([
      { type: 'output', seq: 1, data: 'a' },
      { type: 'output', seq: 2, data: 'b' },
      { type: 'output', seq: 3, data: 'c' },
    ]);
    expect(all.oldestSeq).toBe(1);

    const since = await store.replay(sessionId, 1);
    expect(since.frames.map((f) => f.seq)).toEqual([2, 3]);
  });

  test('prune keeps only the newest N rows and shifts oldestSeq forward', async () => {
    await store.pruneOutput(sessionId, 2);
    const after = await store.replay(sessionId, 0);
    expect(after.frames.map((f) => f.seq)).toEqual([2, 3]); // seq 1 pruned
    expect(after.oldestSeq).toBe(2);
  });

  test('setStatus and finishSession move the session row through its lifecycle', async () => {
    await store.setStatus(sessionId, 'live');
    const [live] = await db
      .select({ status: terminalSessions.status, endedAt: terminalSessions.endedAt })
      .from(terminalSessions)
      .where(eq(terminalSessions.id, sessionId));
    expect(live!.status).toBe('live');
    expect(live!.endedAt).toBeNull();

    await store.finishSession(sessionId, 'exited', 0);
    const [done] = await db
      .select({ status: terminalSessions.status, exitCode: terminalSessions.exitCode, endedAt: terminalSessions.endedAt })
      .from(terminalSessions)
      .where(eq(terminalSessions.id, sessionId));
    expect(done!.status).toBe('exited');
    expect(done!.exitCode).toBe(0);
    expect(done!.endedAt).not.toBeNull();
  });

  test('append with no frames is a no-op', async () => {
    const before = await db
      .select({ id: terminalSessions.id })
      .from(terminalSessions)
      .where(and(eq(terminalSessions.id, sessionId)));
    await store.append(sessionId, []);
    expect(before.length).toBe(1); // still there, no throw
  });

  test('reconcileOrphaned flips starting/live orphans to disconnected and stamps ended_at', async () => {
    const [wd] = await db
      .insert(workdirs)
      .values({ name: 'reconcile-wd', path: '/tmp/reconcile' })
      .returning({ id: workdirs.id });
    const [live] = await db
      .insert(terminalSessions)
      .values({ title: 'orphaned live', workdirId: wd!.id, status: 'live' })
      .returning({ id: terminalSessions.id });
    const [starting] = await db
      .insert(terminalSessions)
      .values({ title: 'orphaned starting', workdirId: wd!.id, status: 'starting' })
      .returning({ id: terminalSessions.id });
    const [done] = await db
      .insert(terminalSessions)
      .values({
        title: 'already exited',
        workdirId: wd!.id,
        status: 'exited',
        endedAt: new Date().toISOString(),
      })
      .returning({ id: terminalSessions.id });

    const n = await store.reconcileOrphaned();
    expect(n).toBeGreaterThanOrEqual(2);

    const [a] = await db
      .select({ status: terminalSessions.status, endedAt: terminalSessions.endedAt })
      .from(terminalSessions)
      .where(eq(terminalSessions.id, live!.id));
    expect(a!.status).toBe('disconnected');
    expect(a!.endedAt).not.toBeNull();

    const [s] = await db
      .select({ status: terminalSessions.status, endedAt: terminalSessions.endedAt })
      .from(terminalSessions)
      .where(eq(terminalSessions.id, starting!.id));
    expect(s!.status).toBe('disconnected');
    expect(s!.endedAt).not.toBeNull();

    const [b] = await db
      .select({ status: terminalSessions.status, endedAt: terminalSessions.endedAt })
      .from(terminalSessions)
      .where(eq(terminalSessions.id, done!.id));
    expect(b!.status).toBe('exited'); // untouched
  });
});
