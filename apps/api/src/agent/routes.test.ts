import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import { agentAgents, agentSessions, environment, users, workdirs } from '@tickets/db';
import { buildApp } from '../app';
import type { StartAgentSpec } from './driver';
import type { AgentDriver } from './driver';
import { createProviderRegistry } from './provider-registry';
import type { AgentRun } from './agent-types';

// Route-level integration test for the agent REST surface. Ported from
// apps/api/src/routes/ai.routes.test.ts, keeping only the agent cases: no
// `kind` discriminator, no workspaceId translation shim — an agent session
// always carries a bare workdirId. Uses a scratch Postgres (same pattern as
// the rest of the api tests) but injects a FAKE driver + FAKE provider, so it
// proves the agents/sessions wiring without an API key or a spawned process.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_agent_routes_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let app: FastifyInstance;

// Records what the routes ask of the driver; has() reports a session as live
// once started and not yet stopped.
const agentStarted: StartAgentSpec[] = [];
const stopped: number[] = [];
const fakeDriver: AgentDriver = {
  start: (spec) => {
    agentStarted.push(spec);
  },
  stop: (id) => {
    stopped.push(id);
  },
  attach: async () => {},
  detach: () => {},
  prompt: () => {},
  interrupt: () => {},
  respondToPermission: () => {},
  has: (id) => agentStarted.some((s) => s.id === id) && !stopped.includes(id),
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

  app = buildApp({ db, agentDriver: fakeDriver, providers: fakeProviders });
  await app.ready();
}, 30_000);

afterAll(async () => {
  await app?.close();
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

async function createWorkdir(name: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/workdirs',
    payload: { name: `${name}-${Date.now()}-${Math.random()}`, path: tmpdir() },
  });
  return res.json().id;
}

async function createAgent(name: string, defaultWorkdirId?: number) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/agent/agents',
    payload: {
      key: `${name}-${Date.now()}-${Math.random()}`,
      name,
      providerKey: 'claude',
      model: 'claude-opus-4-8',
      ...(defaultWorkdirId != null ? { defaultWorkdirId } : {}),
    },
  });
  return res.json();
}

describe('agent routes', () => {
  test('lists providers with their capabilities and models', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agent/providers' });
    expect(res.statusCode).toBe(200);
    const claude = res.json().find((p: { key: string }) => p.key === 'claude');
    expect(claude.capabilities).toMatchObject({ permissions: true, resume: true });
    expect(claude.models.map((m: { id: string }) => m.id)).toContain('claude-opus-4-8');
  });

  test('creating an agent creates a users(kind=agent) row in the same transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/agents',
      payload: {
        key: `architect-${Date.now()}`,
        name: 'Architect',
        providerKey: 'claude',
        model: 'claude-opus-4-8',
        allowedTools: ['Read', 'Grep'],
      },
    });
    expect(res.statusCode).toBe(201);
    const agent = res.json();
    expect(agent).toMatchObject({ permissionMode: 'bypassPermissions' });

    // The owning user row exists with kind 'agent'.
    const [owner] = await db.select().from(users).where(eq(users.id, agent.userId));
    expect(owner).toMatchObject({ name: 'Architect', kind: 'agent' });

    const list = await app.inject({ method: 'GET', url: '/api/agent/agents' });
    expect(list.json().map((a: { key: string }) => a.key)).toContain(agent.key);
  });

  test('patching an agent name syncs the linked user row', async () => {
    const created = await createAgent('Coder');
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/agent/agents/${created.id}`,
      payload: { name: 'Coder II', model: 'claude-sonnet-5' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'Coder II', model: 'claude-sonnet-5' });
    const [owner] = await db.select().from(users).where(eq(users.id, created.userId));
    expect(owner!.name).toBe('Coder II');
  });

  test('an agent session starts via the provider and driver.start', async () => {
    const workdirId = await createWorkdir('agent-wd');
    const agent = await createAgent('Runner', workdirId);

    const before = agentStarted.length;
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/sessions',
      payload: { agentId: agent.id, maxBudgetUsd: 5 },
    });
    expect(res.statusCode).toBe(201);
    const session = res.json();
    expect(session).toMatchObject({ agentId: agent.id, workdirId });
    expect(session).not.toHaveProperty('kind'); // no discriminator any more
    // Provider.start got the workdir path + agent model; driver.start got the
    // session id + budget.
    expect(providerStarted.at(-1)).toMatchObject({ cwd: tmpdir(), model: 'claude-opus-4-8' });
    expect(agentStarted.length).toBe(before + 1);
    expect(agentStarted.at(-1)).toMatchObject({ id: session.id, maxBudgetUsd: 5 });
  });

  test('a dispatched-style agent session records parent_session_id', async () => {
    const workdirId = await createWorkdir('dispatch-wd');
    const agent = await createAgent('Dispatchee', workdirId);
    // A parent session to hang the child off.
    const parent = (
      await app.inject({
        method: 'POST',
        url: '/api/agent/sessions',
        payload: { agentId: agent.id },
      })
    ).json();

    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/sessions',
      payload: { agentId: agent.id, parentSessionId: parent.id },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ parentSessionId: parent.id });
  });

  test('an agent session without a workdir (no default, none passed) is a 400', async () => {
    const agent = await createAgent('NoWd');
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/sessions',
      payload: { agentId: agent.id },
    });
    expect(res.statusCode).toBe(400);
  });

  test('an agent referencing an unknown provider is a 400', async () => {
    const [ghost] = await db
      .insert(agentAgents)
      .values({
        userId: (await db.insert(users).values({ name: 'Ghost', kind: 'agent' }).returning({ id: users.id }))[0]!
          .id,
        key: `ghost-${Date.now()}`,
        name: 'Ghost',
        providerKey: 'codex',
        model: 'x',
      })
      .returning({ id: agentAgents.id });
    const workdirId = await createWorkdir('ghost-wd');
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/sessions',
      payload: { agentId: ghost!.id, workdirId },
    });
    expect(res.statusCode).toBe(400);
  });

  test('404s for an unknown agent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/sessions',
      payload: { agentId: 999_999 },
    });
    expect(res.statusCode).toBe(404);
  });

  test('404s for an unknown session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agent/sessions/999999' });
    expect(res.statusCode).toBe(404);
  });

  test('excludes archived sessions from the list unless ?archived=true', async () => {
    const workdirId = await createWorkdir('list-wd');
    const agent = await createAgent('Lister', workdirId);
    const mkSession = async () =>
      (
        await app.inject({ method: 'POST', url: '/api/agent/sessions', payload: { agentId: agent.id } })
      ).json();
    const live = await mkSession();
    const arch = await mkSession();
    await app.inject({ method: 'POST', url: `/api/agent/sessions/${arch.id}/archive` });

    const def = await app.inject({ method: 'GET', url: '/api/agent/sessions' });
    const ids = def.json().map((s: { id: number }) => s.id);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(arch.id);

    const all = await app.inject({ method: 'GET', url: '/api/agent/sessions?archived=true' });
    expect(all.json().map((s: { id: number }) => s.id)).toContain(arch.id);
  });

  test('archiving a live session stops it via the driver first', async () => {
    const workdirId = await createWorkdir('archive-wd');
    const agent = await createAgent('Archiver', workdirId);
    const s = (
      await app.inject({ method: 'POST', url: '/api/agent/sessions', payload: { agentId: agent.id } })
    ).json();
    const res = await app.inject({ method: 'POST', url: `/api/agent/sessions/${s.id}/archive` });
    expect(res.statusCode).toBe(200);
    expect(stopped).toContain(s.id);
    expect(res.json().archivedAt).not.toBeNull();
  });

  test('archiving a session the driver does not own finalizes it to interrupted', async () => {
    // Inserted directly (not via createSession()), so the fake driver's has()
    // reports false — exercising the "not live" branch.
    const [wd] = await db
      .insert(workdirs)
      .values({ name: `wd-orphan-${Date.now()}-${Math.random()}`, path: tmpdir(), runner: 'local' })
      .returning({ id: workdirs.id });
    const [orphan] = await db
      .insert(agentSessions)
      .values({
        title: 'orphaned session',
        workdirId: wd!.id,
        status: 'running',
        endedAt: null,
      })
      .returning({ id: agentSessions.id });

    const res = await app.inject({
      method: 'POST',
      url: `/api/agent/sessions/${orphan!.id}/archive`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ status: 'interrupted' });
    expect(body.archivedAt).not.toBeNull();
    expect(body.endedAt).not.toBeNull();
  });

  test('unarchive brings a session back into the list', async () => {
    const workdirId = await createWorkdir('unarchive-wd');
    const agent = await createAgent('Unarchiver', workdirId);
    const s = (
      await app.inject({ method: 'POST', url: '/api/agent/sessions', payload: { agentId: agent.id } })
    ).json();
    await app.inject({ method: 'POST', url: `/api/agent/sessions/${s.id}/archive` });
    await app.inject({ method: 'POST', url: `/api/agent/sessions/${s.id}/unarchive` });
    const def = await app.inject({ method: 'GET', url: '/api/agent/sessions' });
    expect(def.json().map((r: { id: number }) => r.id)).toContain(s.id);
  });
});
