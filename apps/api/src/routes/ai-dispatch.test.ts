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
  aiSessions,
  comments,
  ensureSoftwareScheme,
  ensureUser,
  environment,
  seedProject,
  ticketEvents,
} from '@tickets/db';
import type { AgentRun } from '../ai/agent-types';
import { createProviderRegistry } from '../ai/provider-registry';
import type { StartAgentSpec, Supervisor } from '../ai/supervisor';
import type { WorktreeManager } from '../ai/worktree';
import { buildApp } from '../app';

// Full dispatch orchestration (TIX-208) against a scratch Postgres with a real
// seeded project + ticket, but FAKE supervisor / provider / worktree — so the
// whole flow (child session, worktree isolation, dispatched event, prompt, and
// the comment-back on completion) is proven without an API key or a real repo.
const { host, port, user, password } = environment.postgres;
const dbName = `tozf_ai_dispatch_test_${process.pid}_${Date.now()}`;
const adminUrl = `postgres://${user}:${password}@${host}:${port}/postgres`;
const scratchUrl = `postgres://${user}:${password}@${host}:${port}/${dbName}`;

let scratchSql: ReturnType<typeof postgres>;
let db: Db;
let app: FastifyInstance;
const projectKey = 'dsp';

const agentStarted: StartAgentSpec[] = [];
const prompts: { id: number; text: string }[] = [];
const fakeSupervisor: Supervisor = {
  start: () => {},
  startAgent: (spec) => {
    agentStarted.push(spec);
  },
  stop: () => {},
  attach: async () => {},
  detach: () => {},
  write: () => {},
  resize: () => {},
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

let ticketId: number;
let agentId: number;

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

  const { schemeId } = await ensureSoftwareScheme(db);
  await seedProject(db, { key: projectKey, name: 'Dispatch', ticketPrefix: 'DSP', schemeId });
  const actorId = await ensureUser(db, { name: 'dispatcher', kind: 'human' });

  app = buildApp({ db, supervisor: fakeSupervisor, providers, worktrees: fakeWorktrees });
  await app.ready();

  // A ticket to dispatch onto.
  const ticket = await app.inject({
    method: 'POST',
    url: `/api/projects/${projectKey}/tickets`,
    payload: { actorId, typeKey: 'task', values: { title: 'do the work' } },
  });
  ticketId = ticket.json().id;

  // Workspace + agent with that workspace as default.
  const ws = await app.inject({
    method: 'POST',
    url: '/api/ai/workspaces',
    payload: { name: 'dsp-ws', path: tmpdir() },
  });
  const agent = await app.inject({
    method: 'POST',
    url: '/api/ai/agents',
    payload: {
      key: 'dsp-agent',
      name: 'Coder',
      providerKey: 'claude',
      model: 'claude-opus-4-8',
      defaultWorkspaceId: ws.json().id,
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
  test('creates a child session on the ticket, isolates it, prompts it, and comments back on completion', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/dispatch',
      payload: { agentId, ticketId, prompt: 'implement the thing' },
    });
    expect(res.statusCode).toBe(201);
    const session = res.json();
    expect(session).toMatchObject({ kind: 'agent', agentId, ticketId });

    // Ran in its own worktree, started as an agent, and got the opening prompt.
    expect(worktreeCreated).toHaveLength(1);
    expect(agentStarted.at(-1)?.id).toBe(session.id);
    expect(prompts.at(-1)).toEqual({ id: session.id, text: 'implement the thing' });

    // The dispatch was recorded on the ticket immediately.
    const events = await db
      .select()
      .from(ticketEvents)
      .where(eq(ticketEvents.ticketId, ticketId));
    expect(events.some((e) => e.kind === 'agent_dispatched')).toBe(true);

    // Simulate the run finishing, then fire the teardown hook the supervisor
    // would call.
    await db
      .update(aiSessions)
      .set({ status: 'exited', costUsd: '0.4200' })
      .where(eq(aiSessions.id, session.id));
    await agentStarted.at(-1)!.onEnd!();

    // Worktree cleaned up + a summary comment posted back to the ticket.
    expect(worktreeRemoved).toHaveLength(1);
    const ticketComments = await db.select().from(comments).where(eq(comments.ticketId, ticketId));
    expect(ticketComments).toHaveLength(1);
    expect(ticketComments[0]!.body).toContain('Coder finished the dispatched run');
    expect(ticketComments[0]!.body).toContain('$0.42');
  });

  test('rejects a dispatch onto an unknown ticket', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/dispatch',
      payload: { agentId, ticketId: 999_999, prompt: 'x' },
    });
    expect(res.statusCode).toBe(404);
  });
});
