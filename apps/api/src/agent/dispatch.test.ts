import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Db } from '@tickets/db';
import {
  agentSessions,
  comments,
  ensureSoftwareScheme,
  ensureUser,
  environment,
  events,
  seedProject,
} from '@tickets/db';
import { itemCreate } from '../command/item/create';
import { runCommand } from '../command/run-command';
import { buildApp } from '../app';
import type { AgentRun } from './agent-types';
import { createProviderRegistry } from './provider-registry';
import type { AgentDriver, StartAgentSpec } from './driver';
import type { WorktreeManager } from './worktree';

// Full dispatch orchestration against a scratch Postgres with a real seeded
// project + item, but FAKE driver / provider / worktree — so the whole flow
// (child session, worktree isolation, agentDispatched event, prompt, and the
// comment-back on completion) is proven without an API key or a real repo.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_agent_dispatch_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let app: FastifyInstance;
const projectKey = 'dsp';

const agentStarted: StartAgentSpec[] = [];
const prompts: { id: number; text: string }[] = [];
const fakeDriver: AgentDriver = {
  start: (spec) => {
    agentStarted.push(spec);
  },
  stop: () => {},
  attach: async () => {},
  detach: () => {},
  prompt: (id, text) => {
    prompts.push({ id, text });
  },
  interrupt: () => {},
  respondToPermission: () => {},
  has: (id) => agentStarted.some((s) => s.id === id),
  flush: async () => {},
};

const fakeRun: AgentRun = {
  events: (async function* () {})(),
  send: async () => {},
  respondToPermission: async () => {},
  interrupt: async () => {},
  close: () => {},
};
const providers = createProviderRegistry([
  {
    key: 'claude',
    models: () => [{ id: 'claude-opus-4-8', label: 'Opus', contextWindow: 1_000_000 }],
    capabilities: { permissions: true, resume: true, mcp: true, subagents: true },
    start: () => fakeRun,
  },
]);

const worktreeCreated: string[] = [];
const worktreeRemoved: string[] = [];
const fakeWorktrees: WorktreeManager = {
  create: async (spec) => {
    worktreeCreated.push(spec.branch);
    return { path: spec.path, branch: spec.branch };
  },
  remove: async (path) => {
    worktreeRemoved.push(path);
  },
};

let itemId: number;
let agentId: number;

beforeAll(async () => {
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  scratchSql = postgres(scratchUrl, {
    max: 1,
    connection: { search_path: 'core, structure, records, history, public' },
  });
  db = drizzle(scratchSql) as unknown as Db;
  await migrate(db, {
    migrationsFolder: resolve(import.meta.dirname, '../../../../packages/db/drizzle'),
  });

  const { schemeId } = await ensureSoftwareScheme(db);
  await seedProject(db, { key: projectKey, name: 'Dispatch', itemPrefix: 'DSP', schemeId });
  const actorId = await ensureUser(db, { name: 'dispatcher', kind: 'human' });

  app = buildApp({ db, agentDriver: fakeDriver, providers, worktrees: fakeWorktrees });
  await app.ready();

  // An item to dispatch onto. Created through the command pipeline — the
  // platform has no raw-insert route for items.
  const created = await runCommand(
    db,
    itemCreate,
    { commandId: crypto.randomUUID(), actorId },
    { projectKey, typeKey: 'task', values: { title: 'do the work' } },
  );
  itemId = created.id;

  // Workdir + agent with that workdir as default.
  const wd = await app.inject({
    method: 'POST',
    url: '/api/workdirs',
    payload: { name: 'dsp-wd', path: tmpdir() },
  });
  const agent = await app.inject({
    method: 'POST',
    url: '/api/agent/agents',
    payload: {
      key: 'dsp-agent',
      name: 'Coder',
      providerKey: 'claude',
      model: 'claude-opus-4-8',
      defaultWorkdirId: wd.json().id,
    },
  });
  agentId = agent.json().id;
}, 30_000);

afterAll(async () => {
  await app?.close();
  await scratchSql?.end();
  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
  await admin.end();
});

describe('dispatch flow', () => {
  test('creates a child session on the item, isolates it, prompts it, and comments back on completion', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/dispatch',
      payload: { agentId, itemId, prompt: 'implement the thing' },
    });
    expect(res.statusCode).toBe(201);
    const session = res.json();
    expect(session).toMatchObject({ agentId, itemId });

    // Ran in its own worktree, started as an agent, and got the opening prompt.
    expect(worktreeCreated).toHaveLength(1);
    expect(agentStarted.at(-1)?.id).toBe(session.id);
    expect(prompts.at(-1)).toEqual({ id: session.id, text: 'implement the thing' });

    // The "an agent is on this" signal: item.agentDispatched wrote an
    // item.agent_dispatched event via the command pipeline (routes may not
    // write events directly — command/no-raw-writes.test.ts).
    const dispatchEvents = await db
      .select()
      .from(events)
      .where(eq(events.kind, 'item.agent_dispatched'));
    expect(dispatchEvents).toHaveLength(1);
    expect(dispatchEvents[0]!.payload).toEqual({ sessionId: session.id, agentId });

    // Simulate the run finishing, then fire the teardown hook the driver
    // would call.
    await db
      .update(agentSessions)
      .set({ status: 'exited', costUsd: '0.4200' })
      .where(eq(agentSessions.id, session.id));
    await agentStarted.at(-1)!.onEnd!();

    // Worktree cleaned up + a summary comment posted back to the item.
    expect(worktreeRemoved).toHaveLength(1);
    const itemComments = await db.select().from(comments).where(eq(comments.itemId, itemId));
    expect(itemComments).toHaveLength(1);
    expect(itemComments[0]!.body).toContain('Coder finished the dispatched run');
    expect(itemComments[0]!.body).toContain('$0.42');
  });

  test('rejects a dispatch onto an unknown item', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agent/dispatch',
      payload: { agentId, itemId: 999_999, prompt: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });
});
