import { resolve } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { v4 as uuidv4 } from 'uuid';
import { aiAgents, aiSessions, items, users, workdirs } from '@tickets/db';
import { buildRunSpec } from '../ai/agent-run-spec';
import { dispatchComment } from '../ai/dispatch-comment';
import type { ProviderRegistry } from '../ai/provider-registry';
import { assertWorkspaceDir } from '../ai/workspace-fs';
import { resolveSessionCommand } from '../ai/session-command';
import type { Supervisor } from '../ai/supervisor';
import { worktreeName, type WorktreeManager } from '../ai/worktree';
import { itemComment } from '../command/item/comment';
import { runCommand } from '../command/run-command';
import { HttpError } from '../errors';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';

// Cap on concurrent dispatched runs so a fan-out can't spawn unbounded worktrees
// + agent processes (TIX-208).
const MAX_CONCURRENT_DISPATCHES = 4;

const dispatchSchema = v.object({
  agentId: v.pipe(v.number(), v.integer()),
  itemId: v.pipe(v.number(), v.integer()),
  prompt: v.pipe(v.string(), v.minLength(1)),
  parentSessionId: v.optional(v.pipe(v.number(), v.integer())),
  workspaceId: v.optional(v.pipe(v.number(), v.integer())),
  maxBudgetUsd: v.optional(v.number()),
  // Who initiated the dispatch (a human, or a parent agent's user). Defaults to
  // the dispatched agent's own user for attribution.
  actorId: v.optional(v.pipe(v.number(), v.integer())),
});

const permissionModeSchema = v.picklist([
  'default',
  'acceptEdits',
  'bypassPermissions',
  'plan',
  'dontAsk',
  'auto',
]);

const createAgentSchema = v.object({
  key: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  providerKey: v.pipe(v.string(), v.minLength(1)),
  model: v.pipe(v.string(), v.minLength(1)),
  systemPrompt: v.optional(v.string()),
  allowedTools: v.optional(v.array(v.string())),
  disallowedTools: v.optional(v.array(v.string())),
  permissionMode: v.optional(permissionModeSchema),
  mcpServers: v.optional(v.record(v.string(), v.unknown())),
  effort: v.optional(v.string()),
  defaultWorkspaceId: v.optional(v.pipe(v.number(), v.integer())),
  config: v.optional(v.record(v.string(), v.unknown())),
});

const patchAgentSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1))),
  model: v.optional(v.pipe(v.string(), v.minLength(1))),
  systemPrompt: v.optional(v.nullable(v.string())),
  allowedTools: v.optional(v.array(v.string())),
  disallowedTools: v.optional(v.array(v.string())),
  permissionMode: v.optional(permissionModeSchema),
  mcpServers: v.optional(v.record(v.string(), v.unknown())),
  effort: v.optional(v.nullable(v.string())),
  defaultWorkspaceId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  config: v.optional(v.record(v.string(), v.unknown())),
  archived: v.optional(v.boolean()),
});

const runnerSchema = v.picklist(['local', 'container']);

const createWorkspaceSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  path: v.pipe(v.string(), v.minLength(1)),
  runner: v.optional(runnerSchema),
  containerName: v.optional(v.string()),
  gitRemote: v.optional(v.string()),
  defaultBranch: v.optional(v.string()),
  config: v.optional(v.record(v.string(), v.unknown())),
});

const patchWorkspaceSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1))),
  path: v.optional(v.pipe(v.string(), v.minLength(1))),
  runner: v.optional(runnerSchema),
  containerName: v.optional(v.nullable(v.string())),
  gitRemote: v.optional(v.nullable(v.string())),
  defaultBranch: v.optional(v.nullable(v.string())),
  config: v.optional(v.record(v.string(), v.unknown())),
  archived: v.optional(v.boolean()),
});

const createSessionSchema = v.object({
  kind: v.optional(v.picklist(['terminal', 'agent'])),
  // Optional for agent sessions when the agent has a default workspace.
  workspaceId: v.optional(v.pipe(v.number(), v.integer())),
  agentId: v.optional(v.pipe(v.number(), v.integer())),
  // Dispatch wiring (TIX-206): a child session records its parent and the ticket
  // it is working.
  parentSessionId: v.optional(v.pipe(v.number(), v.integer())),
  itemId: v.optional(v.pipe(v.number(), v.integer())),
  title: v.optional(v.pipe(v.string(), v.minLength(1))),
  command: v.optional(v.string()),
  maxBudgetUsd: v.optional(v.number()),
  cols: v.optional(v.pipe(v.number(), v.integer())),
  rows: v.optional(v.pipe(v.number(), v.integer())),
});

export function registerAiRoutes(
  app: FastifyInstance,
  context: {
    db: Db;
    supervisor: Supervisor;
    providers: ProviderRegistry;
    worktrees: WorktreeManager;
  },
) {
  const { db, supervisor, providers, worktrees } = context;
  // Per-app dispatch concurrency counter.
  let activeDispatches = 0;

  // ── Workspaces ─────────────────────────────────────────────────────────────

  const listWorkspaces = async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await db
      .select()
      .from(workdirs)
      .where(isNull(workdirs.archivedAt))
      .orderBy(desc(workdirs.createdAt));
    reply.send(rows);
  };

  const createWorkspace = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createWorkspaceSchema, request.body);
    const inserted = await db
      .insert(workdirs)
      .values({
        name: body.name,
        path: body.path,
        runner: body.runner ?? 'local',
        containerName: body.containerName ?? null,
        gitRemote: body.gitRemote ?? null,
        defaultBranch: body.defaultBranch ?? null,
        ...(body.config !== undefined ? { config: body.config } : {}),
      })
      .returning();
    reply.status(201).send(inserted[0]);
  };

  const patchWorkspace = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const body = parseBody(patchWorkspaceSchema, request.body);
    const [existing] = await db.select().from(workdirs).where(eq(workdirs.id, id));
    if (!existing) throw new HttpError(404, 'workspace not found');
    const updated = await db
      .update(workdirs)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.path !== undefined ? { path: body.path } : {}),
        ...(body.runner !== undefined ? { runner: body.runner } : {}),
        ...(body.containerName !== undefined ? { containerName: body.containerName } : {}),
        ...(body.gitRemote !== undefined ? { gitRemote: body.gitRemote } : {}),
        ...(body.defaultBranch !== undefined ? { defaultBranch: body.defaultBranch } : {}),
        ...(body.config !== undefined ? { config: body.config } : {}),
        ...(body.archived !== undefined
          ? { archivedAt: body.archived ? sql`now()` : null }
          : {}),
      })
      .where(eq(workdirs.id, id))
      .returning();
    reply.send(updated[0]);
  };

  // ── Sessions ───────────────────────────────────────────────────────────────

  const listSessions = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: string; kind?: string; archived?: string };
    const conditions = [];
    if (query.status) conditions.push(eq(aiSessions.status, query.status as never));
    if (query.kind) conditions.push(eq(aiSessions.kind, query.kind as never));
    if (query.archived !== 'true') conditions.push(isNull(aiSessions.archivedAt));
    const rows = await db
      .select()
      .from(aiSessions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(aiSessions.createdAt));
    reply.send(rows.map(toSessionJson));
  };

  // Load + validate a workspace before we insert a row or spawn anything: a bad
  // id is a 404 and a typo'd path a 400, never a session that dies immediately.
  const loadRunnableWorkspace = async (workspaceId: number) => {
    const [workspace] = await db
      .select()
      .from(workdirs)
      .where(eq(workdirs.id, workspaceId));
    if (!workspace) throw new HttpError(404, 'workspace not found');
    if (workspace.runner === 'container') {
      throw new HttpError(400, 'container runner is not supported until E2');
    }
    await assertWorkspaceDir(workspace.path);
    return workspace;
  };

  // aiSessions stores the FK as `workdirId` (core.workdirs replaced
  // ai_workspaces in Task 3), but the HTTP contract still speaks `workspaceId`
  // until Task 7/9 rename the surface — translate at the boundary so the web
  // app needs no changes.
  type AiSessionRow = typeof aiSessions.$inferSelect;
  const toSessionJson = (row: AiSessionRow) => {
    const { workdirId, ...rest } = row;
    return { ...rest, workspaceId: workdirId };
  };

  const createSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createSessionSchema, request.body);
    const kind = body.kind ?? 'terminal';

    if (kind === 'agent') {
      if (body.agentId == null) {
        throw new HttpError(400, 'agentId is required for an agent session');
      }
      const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, body.agentId));
      if (!agent) throw new HttpError(404, 'agent not found');
      const workspaceId = body.workspaceId ?? agent.defaultWorkspaceId;
      if (workspaceId == null) {
        throw new HttpError(400, 'no workspace — pass workspaceId or set the agent default');
      }
      const provider = providers.get(agent.providerKey);
      if (!provider) throw new HttpError(400, `unknown provider "${agent.providerKey}"`);
      const workspace = await loadRunnableWorkspace(workspaceId);

      const [session] = await db
        .insert(aiSessions)
        .values({
          kind: 'agent',
          title: body.title ?? agent.name,
          workdirId: workspace.id,
          agentId: agent.id,
          parentSessionId: body.parentSessionId ?? null,
          itemId: body.itemId ?? null,
          status: 'starting',
          cwd: workspace.path,
        })
        .returning();

      const run = provider.start(
        buildRunSpec(agent, workspace.path, { maxBudgetUsd: body.maxBudgetUsd }),
      );
      supervisor.startAgent({ id: session!.id, run, maxBudgetUsd: body.maxBudgetUsd });
      reply.status(201).send(toSessionJson(session!));
      return;
    }

    // Terminal.
    if (body.workspaceId == null) throw new HttpError(400, 'workspaceId is required');
    const workspace = await loadRunnableWorkspace(body.workspaceId);
    const cmd = resolveSessionCommand(body.command);
    const [session] = await db
      .insert(aiSessions)
      .values({
        kind: 'terminal',
        title: body.title ?? cmd.command,
        workdirId: workspace.id,
        status: 'starting',
        cwd: workspace.path,
      })
      .returning();

    supervisor.start({
      id: session!.id,
      command: cmd.command,
      args: cmd.args,
      cwd: workspace.path,
      cols: body.cols,
      rows: body.rows,
    });

    reply.status(201).send(toSessionJson(session!));
  };

  const getSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(aiSessions).where(eq(aiSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    reply.send(toSessionJson(session));
  };

  const stopSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(aiSessions).where(eq(aiSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    if (supervisor.has(id)) {
      // Live: the supervisor kills the PTY; its exit handler writes the terminal
      // status + ended_at, so we do not race it here.
      supervisor.stop(id);
    } else if (!session.endedAt) {
      // Not live (e.g. the API restarted under it): finalize the row directly.
      await db
        .update(aiSessions)
        .set({ status: 'exited', endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(aiSessions.id, id));
    }
    reply.send({ ok: true, id });
  };

  const archiveSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(aiSessions).where(eq(aiSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    if (supervisor.has(id)) {
      supervisor.stop(id); // its exit handler finalizes status + ended_at
    } else if (!session.endedAt) {
      await db
        .update(aiSessions)
        .set({ status: 'disconnected', endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(aiSessions.id, id));
    }
    await db
      .update(aiSessions)
      .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(aiSessions.id, id));
    const [row] = await db.select().from(aiSessions).where(eq(aiSessions.id, id));
    reply.send(toSessionJson(row!));
  };

  const unarchiveSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(aiSessions).where(eq(aiSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    await db
      .update(aiSessions)
      .set({ archivedAt: null, updatedAt: sql`now()` })
      .where(eq(aiSessions.id, id));
    const [row] = await db.select().from(aiSessions).where(eq(aiSessions.id, id));
    reply.send(toSessionJson(row!));
  };

  // ── Dispatch (TIX-208) — put an agent on a ticket ───────────────────────────

  const dispatch = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(dispatchSchema, request.body);
    if (activeDispatches >= MAX_CONCURRENT_DISPATCHES) {
      throw new HttpError(429, `dispatch limit reached (${MAX_CONCURRENT_DISPATCHES} concurrent)`);
    }
    const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, body.agentId));
    if (!agent) throw new HttpError(404, 'agent not found');
    const [item] = await db.select({ id: items.id }).from(items).where(eq(items.id, body.itemId));
    if (!item) throw new HttpError(404, 'item not found');
    const workspaceId = body.workspaceId ?? agent.defaultWorkspaceId;
    if (workspaceId == null) throw new HttpError(400, 'no workspace — set the agent default or pass workspaceId');
    const provider = providers.get(agent.providerKey);
    if (!provider) throw new HttpError(400, `unknown provider "${agent.providerKey}"`);
    const workspace = await loadRunnableWorkspace(workspaceId);

    // Child session first, so its id names the worktree.
    const [session] = await db
      .insert(aiSessions)
      .values({
        kind: 'agent',
        title: `${agent.name} · ${body.itemId}`,
        workdirId: workspace.id,
        agentId: agent.id,
        parentSessionId: body.parentSessionId ?? null,
        itemId: body.itemId,
        status: 'starting',
        cwd: workspace.path,
      })
      .returning();

    // Isolated git worktree so parallel dispatches don't collide. Best-effort:
    // a non-git workspace just runs in place.
    let worktreePath: string | null = null;
    let cwd = workspace.path;
    try {
      const branch = worktreeName(session!.id, `i${body.itemId}`);
      const path = resolve(workspace.path, '..', `${workspace.name}-s${session!.id}`);
      const created = await worktrees.create({ repoPath: workspace.path, branch, path });
      worktreePath = created.path;
      cwd = created.path;
      await db
        .update(aiSessions)
        .set({ cwd, worktreePath })
        .where(eq(aiSessions.id, session!.id));
    } catch {
      // not a git repo / worktree unavailable — run in the workspace dir
    }

    activeDispatches += 1;
    const run = provider.start(buildRunSpec(agent, cwd, { maxBudgetUsd: body.maxBudgetUsd }));
    supervisor.startAgent({
      id: session!.id,
      run,
      maxBudgetUsd: body.maxBudgetUsd,
      onEnd: async () => {
        activeDispatches = Math.max(0, activeDispatches - 1);
        if (worktreePath) await worktrees.remove(worktreePath).catch(() => {});
        const [final] = await db
          .select({ status: aiSessions.status, costUsd: aiSessions.costUsd })
          .from(aiSessions)
          .where(eq(aiSessions.id, session!.id));
        if (!final) return;
        // Comment the outcome back on the item. The platform forbids routes
        // writing comments/events directly (command/no-raw-writes.test.ts) —
        // itemComment inserts the row and emits commentAdded in one command.
        await runCommand(
          db,
          itemComment,
          { commandId: uuidv4(), actorId: agent.userId },
          {
            itemId: body.itemId,
            body: dispatchComment(agent.name, final.status, final.costUsd, session!.id),
          },
        );
      },
    });
    supervisor.prompt(session!.id, body.prompt);
    reply.status(201).send(toSessionJson(session!));
  };

  // ── Providers (code registry, read-only) ───────────────────────────────────

  const listProviders = async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.send(
      providers.list().map((p) => ({
        key: p.key,
        capabilities: p.capabilities,
        models: p.models(),
      })),
    );
  };

  // ── Agents (personas) ──────────────────────────────────────────────────────

  const listAgents = async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await db
      .select()
      .from(aiAgents)
      .where(isNull(aiAgents.archivedAt))
      .orderBy(desc(aiAgents.createdAt));
    reply.send(rows);
  };

  const createAgent = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createAgentSchema, request.body);
    // Creating an agent creates its owning users(kind='agent') row in the SAME
    // transaction — that is what makes the persona assignable to tickets and
    // attributable in events with zero ticket-system changes.
    const agent = await db.transaction(async (tx) => {
      const [owner] = await tx
        .insert(users)
        .values({ name: body.name, kind: 'agent' })
        .returning({ id: users.id });
      const [created] = await tx
        .insert(aiAgents)
        .values({
          userId: owner!.id,
          key: body.key,
          name: body.name,
          providerKey: body.providerKey,
          model: body.model,
          systemPrompt: body.systemPrompt ?? null,
          ...(body.allowedTools ? { allowedTools: body.allowedTools } : {}),
          ...(body.disallowedTools ? { disallowedTools: body.disallowedTools } : {}),
          ...(body.permissionMode ? { permissionMode: body.permissionMode } : {}),
          ...(body.mcpServers ? { mcpServers: body.mcpServers } : {}),
          effort: body.effort ?? null,
          defaultWorkspaceId: body.defaultWorkspaceId ?? null,
          ...(body.config ? { config: body.config } : {}),
        })
        .returning();
      return created;
    });
    reply.status(201).send(agent);
  };

  const patchAgent = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const body = parseBody(patchAgentSchema, request.body);
    const [existing] = await db.select().from(aiAgents).where(eq(aiAgents.id, id));
    if (!existing) throw new HttpError(404, 'agent not found');
    const updated = await db.transaction(async (tx) => {
      // Keep the linked users row's name in sync so ticket attribution matches.
      if (body.name !== undefined) {
        await tx.update(users).set({ name: body.name }).where(eq(users.id, existing.userId));
      }
      const [row] = await tx
        .update(aiAgents)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.model !== undefined ? { model: body.model } : {}),
          ...(body.systemPrompt !== undefined ? { systemPrompt: body.systemPrompt } : {}),
          ...(body.allowedTools !== undefined ? { allowedTools: body.allowedTools } : {}),
          ...(body.disallowedTools !== undefined ? { disallowedTools: body.disallowedTools } : {}),
          ...(body.permissionMode !== undefined ? { permissionMode: body.permissionMode } : {}),
          ...(body.mcpServers !== undefined ? { mcpServers: body.mcpServers } : {}),
          ...(body.effort !== undefined ? { effort: body.effort } : {}),
          ...(body.defaultWorkspaceId !== undefined
            ? { defaultWorkspaceId: body.defaultWorkspaceId }
            : {}),
          ...(body.config !== undefined ? { config: body.config } : {}),
          ...(body.archived !== undefined
            ? { archivedAt: body.archived ? sql`now()` : null }
            : {}),
        })
        .where(eq(aiAgents.id, id))
        .returning();
      return row;
    });
    reply.send(updated);
  };

  app.get('/api/ai/workspaces', listWorkspaces);
  app.post('/api/ai/workspaces', createWorkspace);
  app.patch('/api/ai/workspaces/:id', patchWorkspace);
  app.get('/api/ai/providers', listProviders);
  app.get('/api/ai/agents', listAgents);
  app.post('/api/ai/agents', createAgent);
  app.patch('/api/ai/agents/:id', patchAgent);
  app.get('/api/ai/sessions', listSessions);
  app.post('/api/ai/sessions', createSession);
  app.get('/api/ai/sessions/:id', getSession);
  app.delete('/api/ai/sessions/:id', stopSession);
  app.post('/api/ai/sessions/:id/archive', archiveSession);
  app.post('/api/ai/sessions/:id/unarchive', unarchiveSession);
  app.post('/api/ai/dispatch', dispatch);
}
