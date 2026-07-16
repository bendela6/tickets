import { resolve } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import { aiSessions, aiWorkspaces, environment } from '@tickets/db';
import { createDbSessionStore } from './db-session-store';

// Real-Postgres test for the SessionStore adapter — same scratch-db-per-run
// pattern as app.test.ts. Verifies the SQL for append/replay/prune/lifecycle
// against actual rows, so the supervisor's fake-store unit tests are trustworthy.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_ai_store_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let store: ReturnType<typeof createDbSessionStore>;
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

  const [ws] = await db
    .insert(aiWorkspaces)
    .values({ name: 'test-ws', path: '/tmp/ws' })
    .returning({ id: aiWorkspaces.id });
  const [session] = await db
    .insert(aiSessions)
    .values({ kind: 'terminal', title: 'test session', workspaceId: ws!.id })
    .returning({ id: aiSessions.id });
  sessionId = session!.id;
  store = createDbSessionStore(db);
}, 30_000);

afterAll(async () => {
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

describe('DbSessionStore', () => {
  test('appends chunks and replays only those after a given seq, ascending', async () => {
    await store.appendOutput(sessionId, [
      { seq: 1, data: 'a' },
      { seq: 2, data: 'b' },
      { seq: 3, data: 'c' },
    ]);

    const all = await store.loadOutputSince(sessionId, 0);
    expect(all.chunks).toEqual([
      { seq: 1, data: 'a' },
      { seq: 2, data: 'b' },
      { seq: 3, data: 'c' },
    ]);
    expect(all.oldestSeq).toBe(1);

    const since = await store.loadOutputSince(sessionId, 1);
    expect(since.chunks.map((c) => c.seq)).toEqual([2, 3]);
  });

  test('prune keeps only the newest N rows and shifts oldestSeq forward', async () => {
    await store.pruneOutput(sessionId, 2);
    const after = await store.loadOutputSince(sessionId, 0);
    expect(after.chunks.map((c) => c.seq)).toEqual([2, 3]); // seq 1 pruned
    expect(after.oldestSeq).toBe(2);
  });

  test('markRunning and finishSession move the session row through its lifecycle', async () => {
    await store.markRunning(sessionId);
    const [running] = await db
      .select({ status: aiSessions.status, endedAt: aiSessions.endedAt })
      .from(aiSessions)
      .where(eq(aiSessions.id, sessionId));
    expect(running!.status).toBe('running');
    expect(running!.endedAt).toBeNull();

    await store.finishSession(sessionId, 'exited', 0);
    const [done] = await db
      .select({ status: aiSessions.status, exitCode: aiSessions.exitCode, endedAt: aiSessions.endedAt })
      .from(aiSessions)
      .where(eq(aiSessions.id, sessionId));
    expect(done!.status).toBe('exited');
    expect(done!.exitCode).toBe(0);
    expect(done!.endedAt).not.toBeNull();
  });

  test('appendOutput with no chunks is a no-op', async () => {
    const before = await db
      .select({ seq: aiSessions.id })
      .from(aiSessions)
      .where(and(eq(aiSessions.id, sessionId)));
    await store.appendOutput(sessionId, []);
    expect(before.length).toBe(1); // still there, no throw
  });
});
