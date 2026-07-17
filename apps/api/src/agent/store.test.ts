import { resolve } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import { agentPermissionRequests, agentSessions, environment, workdirs } from '@tickets/db';
import { createAgentStore } from './store';

// Real-Postgres test for the AgentStore adapter — same scratch-db-per-run
// pattern as the rest of the api tests. Verifies the SQL for append/replay/
// lifecycle/permissions against actual rows, so the driver's fake-store unit
// tests are trustworthy.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_agent_store_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let store: ReturnType<typeof createAgentStore>;
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
    .insert(agentSessions)
    .values({ title: 'test session', workdirId: wd!.id })
    .returning({ id: agentSessions.id });
  sessionId = session!.id;
  store = createAgentStore(db);
}, 30_000);

afterAll(async () => {
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

describe('AgentStore', () => {
  test('appends frames and replays only those after a given seq, ascending', async () => {
    await store.append(sessionId, [
      { type: 'message', seq: 1, event: { type: 'session_started', providerSessionId: 'sess_x' } },
      { type: 'message', seq: 2, event: { type: 'assistant_text', text: 'hello' } },
      { type: 'message', seq: 3, event: { type: 'tool_use', id: 'tu_1', name: 'Read', input: { f: 'a.ts' } } },
    ]);

    const all = await store.replay(sessionId, 0);
    expect(all.oldestSeq).toBe(1);
    expect(all.frames.map((f) => [f.seq, f.event.type])).toEqual([
      [1, 'session_started'],
      [2, 'assistant_text'],
      [3, 'tool_use'],
    ]);
    // The full event is reconstructed verbatim from the stored jsonb.
    expect(all.frames[2]!.event).toEqual({
      type: 'tool_use',
      id: 'tu_1',
      name: 'Read',
      input: { f: 'a.ts' },
    });

    const since = await store.replay(sessionId, 2);
    expect(since.frames.map((f) => f.seq)).toEqual([3]);
  });

  test('markRunning and finishSession move the session row through its lifecycle (no exit code)', async () => {
    await store.markRunning(sessionId);
    const [running] = await db
      .select({ status: agentSessions.status, endedAt: agentSessions.endedAt })
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId));
    expect(running!.status).toBe('running');
    expect(running!.endedAt).toBeNull();

    await store.finishSession(sessionId, 'exited');
    const [done] = await db
      .select({ status: agentSessions.status, endedAt: agentSessions.endedAt })
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId));
    expect(done!.status).toBe('exited');
    expect(done!.endedAt).not.toBeNull();
  });

  test('append with no frames is a no-op', async () => {
    const before = await db
      .select({ id: agentSessions.id })
      .from(agentSessions)
      .where(and(eq(agentSessions.id, sessionId)));
    await store.append(sessionId, []);
    expect(before.length).toBe(1); // still there, no throw
  });

  test('permission requests: create pending, then record the decision', async () => {
    const id = await store.createPermissionRequest(sessionId, 'Bash', { command: 'rm -rf x' });
    const [pending] = await db
      .select()
      .from(agentPermissionRequests)
      .where(eq(agentPermissionRequests.id, id));
    expect(pending).toMatchObject({ toolName: 'Bash', status: 'pending', decidedAt: null });
    expect(pending!.input).toEqual({ command: 'rm -rf x' });

    await store.decidePermissionRequest(id, 'denied', 'too destructive');
    const [decided] = await db
      .select()
      .from(agentPermissionRequests)
      .where(eq(agentPermissionRequests.id, id));
    expect(decided).toMatchObject({ status: 'denied', decisionReason: 'too destructive' });
    expect(decided!.decidedAt).not.toBeNull();
  });

  test('setCost and setStatus update the session row without stamping ended_at', async () => {
    const [wd] = await db
      .insert(workdirs)
      .values({ name: 'cost-wd', path: '/tmp/cost' })
      .returning({ id: workdirs.id });
    const [fresh] = await db
      .insert(agentSessions)
      .values({ title: 'cost session', workdirId: wd!.id })
      .returning({ id: agentSessions.id });

    await store.setCost(fresh!.id, 1.2345);
    await store.setStatus(fresh!.id, 'idle');
    const [row] = await db
      .select({ costUsd: agentSessions.costUsd, status: agentSessions.status, endedAt: agentSessions.endedAt })
      .from(agentSessions)
      .where(eq(agentSessions.id, fresh!.id));
    expect(Number(row!.costUsd)).toBeCloseTo(1.2345, 4);
    expect(row!.status).toBe('idle');
    expect(row!.endedAt).toBeNull();
  });

  test('reconcileOrphaned flips live-ish orphans to interrupted and stamps ended_at', async () => {
    const [wd] = await db
      .insert(workdirs)
      .values({ name: 'reconcile-wd', path: '/tmp/reconcile' })
      .returning({ id: workdirs.id });
    const [running] = await db
      .insert(agentSessions)
      .values({ title: 'orphaned running', workdirId: wd!.id, status: 'running' })
      .returning({ id: agentSessions.id });
    const [awaiting] = await db
      .insert(agentSessions)
      .values({ title: 'orphaned awaiting', workdirId: wd!.id, status: 'awaiting_input' })
      .returning({ id: agentSessions.id });
    const [done] = await db
      .insert(agentSessions)
      .values({
        title: 'already exited',
        workdirId: wd!.id,
        status: 'exited',
        endedAt: new Date().toISOString(),
      })
      .returning({ id: agentSessions.id });

    const n = await store.reconcileOrphaned();
    expect(n).toBeGreaterThanOrEqual(2);

    const [a] = await db
      .select({ status: agentSessions.status, endedAt: agentSessions.endedAt })
      .from(agentSessions)
      .where(eq(agentSessions.id, running!.id));
    expect(a!.status).toBe('interrupted');
    expect(a!.endedAt).not.toBeNull();

    const [b] = await db
      .select({ status: agentSessions.status, endedAt: agentSessions.endedAt })
      .from(agentSessions)
      .where(eq(agentSessions.id, awaiting!.id));
    expect(b!.status).toBe('interrupted');
    expect(b!.endedAt).not.toBeNull();

    const [c] = await db
      .select({ status: agentSessions.status, endedAt: agentSessions.endedAt })
      .from(agentSessions)
      .where(eq(agentSessions.id, done!.id));
    expect(c!.status).toBe('exited'); // untouched
  });
});
