import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { aiAgents, environment, users } from '@tickets/db';
import type { AgentRun } from '../ai/agent-types';
import { createProviderRegistry } from '../ai/provider-registry';
import type { StartAgentSpec, StartSpec, Supervisor } from '../ai/supervisor';
import { buildApp } from '../app';

// Route-level integration test for the AI REST surface. Uses a scratch Postgres
// (same pattern as app.test.ts) but injects a FAKE supervisor, so it proves the
// workspaces/sessions wiring — path + runner validation, insert, stop — without
// spawning a real PTY. The real supervisor is covered by its own unit tests and
// the LocalRunner spawn test.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_ai_routes_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let app: FastifyInstance;

// Records what the routes ask of the supervisor; has() reports a session as live
// once started and not yet stopped.
const started: StartSpec[] = [];
const agentStarted: StartAgentSpec[] = [];
const stopped: number[] = [];
const fakeSupervisor: Supervisor = {
  start: (spec) => {
    started.push(spec);
  },
  startAgent: (spec) => {
    agentStarted.push(spec);
  },
  stop: (id) => {
    stopped.push(id);
  },
  attach: async () => {},
  detach: () => {},
  write: () => {},
  resize: () => {},
  prompt: () => {},
  interrupt: () => {},
  respondToPermission: () => {},
  has: (id) =>
    (started.some((s) => s.id === id) || agentStarted.some((s) => s.id === id)) &&
    !stopped.includes(id),
  flush: async () => {},
};

// A fake AgentRun + provider so agent-session creation is proven without the SDK.
const providerStarted: { cwd: string; model: string }[] = [];
const fakeRun: AgentRun = {
  events: (async function* () {})(),
  send: async () => {},
  respondToPermission: async () => {},
  interrupt: async () => {},
  close: () => {},
};
const fakeProviders = createProviderRegistry([
  {
    key: 'claude',
    models: () => [{ id: 'claude-opus-4-8', label: 'Opus', contextWindow: 1_000_000 }],
    capabilities: { permissions: true, resume: true, mcp: true, subagents: true },
    start: (spec) => {
      providerStarted.push({ cwd: spec.cwd, model: spec.model });
      return fakeRun;
    },
  },
]);

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

  app = buildApp({ db, supervisor: fakeSupervisor, providers: fakeProviders });
  await app.ready();
}, 30_000);

afterAll(async () => {
  await app?.close();
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

describe('AI routes', () => {
  test('creates, lists, and archives workspaces', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/ai/workspaces',
      payload: { name: 'ws-a', path: tmpdir() },
    });
    expect(created.statusCode).toBe(201);
    const ws = created.json();
    expect(ws).toMatchObject({ name: 'ws-a', path: tmpdir(), runner: 'local' });

    const list = await app.inject({ method: 'GET', url: '/api/ai/workspaces' });
    expect(list.json().map((w: { name: string }) => w.name)).toContain('ws-a');

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/ai/workspaces/${ws.id}`,
      payload: { archived: true },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().archivedAt).not.toBeNull();

    const after = await app.inject({ method: 'GET', url: '/api/ai/workspaces' });
    expect(after.json().map((w: { name: string }) => w.name)).not.toContain('ws-a');
  });

  test('creating a session validates path + runner, spawns, and is retrievable', async () => {
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/ai/workspaces',
      payload: { name: 'ws-live', path: tmpdir() },
    });
    const workspaceId = wsRes.json().id;

    const before = started.length;
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/sessions',
      payload: { kind: 'terminal', workspaceId, title: 'my shell' },
    });
    expect(res.statusCode).toBe(201);
    const session = res.json();
    expect(session).toMatchObject({ kind: 'terminal', title: 'my shell', workspaceId });
    expect(started.length).toBe(before + 1);
    expect(started.at(-1)).toMatchObject({ id: session.id, cwd: tmpdir() });

    const got = await app.inject({ method: 'GET', url: `/api/ai/sessions/${session.id}` });
    expect(got.statusCode).toBe(200);
    expect(got.json().id).toBe(session.id);

    const listed = await app.inject({ method: 'GET', url: '/api/ai/sessions?kind=terminal' });
    expect(listed.json().map((s: { id: number }) => s.id)).toContain(session.id);
  });

  test('rejects a non-existent workspace path with 400 (no session created)', async () => {
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/ai/workspaces',
      payload: { name: 'ws-badpath', path: resolve(tmpdir(), 'definitely-not-here-xyz') },
    });
    const workspaceId = wsRes.json().id;
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/sessions',
      payload: { kind: 'terminal', workspaceId },
    });
    expect(res.statusCode).toBe(400);
  });

  test('rejects the container runner and non-terminal kinds until E2', async () => {
    const wsRes = await app.inject({
      method: 'POST',
      url: '/api/ai/workspaces',
      payload: { name: 'ws-container', path: tmpdir(), runner: 'container' },
    });
    const containerWs = wsRes.json().id;
    const containerRes = await app.inject({
      method: 'POST',
      url: '/api/ai/sessions',
      payload: { kind: 'terminal', workspaceId: containerWs },
    });
    expect(containerRes.statusCode).toBe(400);

    const localWs = (
      await app.inject({
        method: 'POST',
        url: '/api/ai/workspaces',
        payload: { name: 'ws-forkind', path: tmpdir() },
      })
    ).json().id;
    const agentRes = await app.inject({
      method: 'POST',
      url: '/api/ai/sessions',
      payload: { kind: 'agent', workspaceId: localWs },
    });
    expect(agentRes.statusCode).toBe(400);
  });

  test('DELETE stops a live session via the supervisor', async () => {
    const workspaceId = (
      await app.inject({
        method: 'POST',
        url: '/api/ai/workspaces',
        payload: { name: 'ws-stop', path: tmpdir() },
      })
    ).json().id;
    const session = (
      await app.inject({
        method: 'POST',
        url: '/api/ai/sessions',
        payload: { kind: 'terminal', workspaceId },
      })
    ).json();

    const res = await app.inject({ method: 'DELETE', url: `/api/ai/sessions/${session.id}` });
    expect(res.statusCode).toBe(200);
    expect(stopped).toContain(session.id);
  });

  test('404s for an unknown session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ai/sessions/999999' });
    expect(res.statusCode).toBe(404);
  });

  test('creating an agent creates a users(kind=agent) row in the same transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/agents',
      payload: {
        key: 'architect',
        name: 'Architect',
        providerKey: 'claude',
        model: 'claude-opus-4-8',
        allowedTools: ['Read', 'Grep'],
      },
    });
    expect(res.statusCode).toBe(201);
    const agent = res.json();
    expect(agent).toMatchObject({ key: 'architect', permissionMode: 'bypassPermissions' });

    // The owning user row exists with kind 'agent'.
    const [owner] = await db.select().from(users).where(eq(users.id, agent.userId));
    expect(owner).toMatchObject({ name: 'Architect', kind: 'agent' });

    const list = await app.inject({ method: 'GET', url: '/api/ai/agents' });
    expect(list.json().map((a: { key: string }) => a.key)).toContain('architect');
  });

  test('patching an agent name syncs the linked user row', async () => {
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/ai/agents',
        payload: { key: 'coder', name: 'Coder', providerKey: 'claude', model: 'claude-opus-4-8' },
      })
    ).json();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/ai/agents/${created.id}`,
      payload: { name: 'Coder II', model: 'claude-sonnet-5' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'Coder II', model: 'claude-sonnet-5' });
    const [owner] = await db.select().from(users).where(eq(users.id, created.userId));
    expect(owner!.name).toBe('Coder II');
  });

  test('an agent session starts via the provider and supervisor.startAgent', async () => {
    const workspaceId = (
      await app.inject({
        method: 'POST',
        url: '/api/ai/workspaces',
        payload: { name: 'agent-ws', path: tmpdir() },
      })
    ).json().id;
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/api/ai/agents',
        payload: {
          key: 'runner-agent',
          name: 'Runner',
          providerKey: 'claude',
          model: 'claude-opus-4-8',
          defaultWorkspaceId: workspaceId,
        },
      })
    ).json();

    const before = agentStarted.length;
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/sessions',
      payload: { kind: 'agent', agentId: agent.id, maxBudgetUsd: 5 },
    });
    expect(res.statusCode).toBe(201);
    const session = res.json();
    expect(session).toMatchObject({ kind: 'agent', agentId: agent.id, workspaceId });
    // Provider.start got the workspace path + agent model; supervisor.startAgent
    // got the session id + budget.
    expect(providerStarted.at(-1)).toMatchObject({ cwd: tmpdir(), model: 'claude-opus-4-8' });
    expect(agentStarted.length).toBe(before + 1);
    expect(agentStarted.at(-1)).toMatchObject({ id: session.id, maxBudgetUsd: 5 });
  });

  test('an agent session without a workspace (no default, none passed) is a 400', async () => {
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/api/ai/agents',
        payload: { key: 'no-ws', name: 'NoWs', providerKey: 'claude', model: 'claude-opus-4-8' },
      })
    ).json();
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/sessions',
      payload: { kind: 'agent', agentId: agent.id },
    });
    expect(res.statusCode).toBe(400);
  });

  test('an agent referencing an unknown provider is a 400', async () => {
    const [ghost] = await db
      .insert(aiAgents)
      .values({
        userId: (await db.insert(users).values({ name: 'Ghost', kind: 'agent' }).returning({ id: users.id }))[0]!.id,
        key: 'ghost',
        name: 'Ghost',
        providerKey: 'codex',
        model: 'x',
      })
      .returning({ id: aiAgents.id });
    const workspaceId = (
      await app.inject({
        method: 'POST',
        url: '/api/ai/workspaces',
        payload: { name: 'ghost-ws', path: tmpdir() },
      })
    ).json().id;
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/sessions',
      payload: { kind: 'agent', agentId: ghost!.id, workspaceId },
    });
    expect(res.statusCode).toBe(400);
  });
});
