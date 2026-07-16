import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import {
  aiAgents,
  aiMessages,
  aiPermissionRequests,
  aiSessions,
  aiWorkspaces,
  environment,
  users,
} from '@tickets/db';

// Round-trips the E2 `ai` tables against a real Postgres (same scratch-db-per-run
// pattern as the store tests): an agent owns a users(kind='agent') row, a session
// references that agent, and messages + a permission request hang off the
// session. Proves the migration applies and the new FKs hold before anything is
// built on them.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_e2_schema_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;

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
}, 30_000);

afterAll(async () => {
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

describe('E2 ai schema', () => {
  test('an agent owns a user row and a session links to it, with messages + a permission request', async () => {
    const [agentUser] = await db
      .insert(users)
      .values({ name: 'Architect', kind: 'agent' })
      .returning({ id: users.id });

    const [ws] = await db
      .insert(aiWorkspaces)
      .values({ name: 'e2-ws', path: '/tmp/e2' })
      .returning({ id: aiWorkspaces.id });

    const [agent] = await db
      .insert(aiAgents)
      .values({
        userId: agentUser!.id,
        key: 'architect',
        name: 'Architect',
        providerKey: 'claude',
        model: 'claude-opus-4-8',
        allowedTools: ['Read', 'Grep'],
        defaultWorkspaceId: ws!.id,
      })
      .returning();
    // Defaults land as written.
    expect(agent!.permissionMode).toBe('bypassPermissions');
    expect(agent!.allowedTools).toEqual(['Read', 'Grep']);

    const [session] = await db
      .insert(aiSessions)
      .values({
        kind: 'agent',
        title: 'plan the work',
        workspaceId: ws!.id,
        agentId: agent!.id,
        status: 'running',
      })
      .returning({ id: aiSessions.id, agentId: aiSessions.agentId });
    expect(session!.agentId).toBe(agent!.id);

    await db.insert(aiMessages).values([
      { sessionId: session!.id, seq: 1, role: 'assistant', kind: 'assistant_text', content: { text: 'hi' } },
      {
        sessionId: session!.id,
        seq: 2,
        role: 'assistant',
        kind: 'tool_use',
        content: { name: 'Read', input: { file: 'a.ts' } },
        toolUseId: 'tu_1',
      },
    ]);

    const messages = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.sessionId, session!.id))
      .orderBy(aiMessages.seq);
    expect(messages.map((m) => m.kind)).toEqual(['assistant_text', 'tool_use']);
    expect(messages[1]!.toolUseId).toBe('tu_1');

    const [perm] = await db
      .insert(aiPermissionRequests)
      .values({ sessionId: session!.id, toolName: 'Bash', input: { command: 'rm -rf x' } })
      .returning();
    expect(perm!.status).toBe('pending');
    expect(perm!.decidedAt).toBeNull();
  });

  test('the session→agent FK rejects a dangling agent id', async () => {
    const [ws] = await db
      .insert(aiWorkspaces)
      .values({ name: 'e2-ws-2', path: '/tmp/e2b' })
      .returning({ id: aiWorkspaces.id });
    await expect(
      db.insert(aiSessions).values({
        kind: 'agent',
        title: 'bad',
        workspaceId: ws!.id,
        agentId: 999_999,
        status: 'starting',
      }),
    ).rejects.toThrow();
  });
});
