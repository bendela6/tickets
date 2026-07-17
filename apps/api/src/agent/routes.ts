import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import type { Db } from '@tickets/db';
import { agentAgents, agentSessions, users } from '@tickets/db';
import { HttpError } from '../errors';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';
import { loadRunnableWorkdir } from '../workdir/load-workdir';
import { buildRunSpec } from './agent-run-spec';
import type { AgentDriver } from './driver';
import type { ProviderRegistry } from './provider-registry';

const permissionModeSchema = v.picklist(['default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk']);

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
  defaultWorkdirId: v.optional(v.pipe(v.number(), v.integer())),
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
  defaultWorkdirId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  config: v.optional(v.record(v.string(), v.unknown())),
  archived: v.optional(v.boolean()),
});

const createSessionSchema = v.object({
  agentId: v.pipe(v.number(), v.integer()),
  // Optional when the agent has a default workdir.
  workdirId: v.optional(v.pipe(v.number(), v.integer())),
  // Dispatch wiring: a child session records its parent and the item it is
  // working.
  parentSessionId: v.optional(v.pipe(v.number(), v.integer())),
  itemId: v.optional(v.pipe(v.number(), v.integer())),
  title: v.optional(v.pipe(v.string(), v.minLength(1))),
  maxBudgetUsd: v.optional(v.number()),
});

export function registerAgentRoutes(
  app: FastifyInstance,
  context: { db: Db; driver: AgentDriver; providers: ProviderRegistry },
): void {
  const { db, driver, providers } = context;

  // ── Sessions ─────────────────────────────────────────────────────────────

  const listSessions = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: string; archived?: string };
    const conditions = [];
    if (query.status) conditions.push(eq(agentSessions.status, query.status as never));
    if (query.archived !== 'true') conditions.push(isNull(agentSessions.archivedAt));
    const rows = await db
      .select()
      .from(agentSessions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(agentSessions.createdAt));
    reply.send(rows);
  };

  const createSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createSessionSchema, request.body);
    const [agent] = await db.select().from(agentAgents).where(eq(agentAgents.id, body.agentId));
    if (!agent) throw new HttpError(404, 'agent not found');
    const workdirId = body.workdirId ?? agent.defaultWorkdirId;
    if (workdirId == null) {
      throw new HttpError(400, 'no workdir — pass workdirId or set the agent default');
    }
    const provider = providers.get(agent.providerKey);
    if (!provider) throw new HttpError(400, `unknown provider "${agent.providerKey}"`);
    const workdir = await loadRunnableWorkdir(db, workdirId);

    const [session] = await db
      .insert(agentSessions)
      .values({
        title: body.title ?? agent.name,
        workdirId: workdir.id,
        agentId: agent.id,
        parentSessionId: body.parentSessionId ?? null,
        itemId: body.itemId ?? null,
        status: 'starting',
        cwd: workdir.path,
      })
      .returning();

    const run = provider.start(buildRunSpec(agent, workdir.path, { maxBudgetUsd: body.maxBudgetUsd }));
    driver.start({ id: session!.id, run, maxBudgetUsd: body.maxBudgetUsd });
    reply.status(201).send(session);
  };

  const getSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    reply.send(session);
  };

  // End the run without hiding it. Stop and archive are two different acts:
  // stopping closes the run and finalizes the row, and the session stays in
  // the list as `interrupted`/`exited` for the user to read the transcript;
  // archiving is what takes it off the list. Folding the two together would
  // mean a session could only be ended by making it disappear — and would
  // leave `interrupted`/`exited` reachable only via a route that immediately
  // hides the row. (`archived_at` stays NULL here; see archiveSession below,
  // which is this body plus the archive UPDATE.)
  const stopSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    if (driver.has(id)) {
      driver.stop(id);
    } else if (!session.endedAt) {
      await db
        .update(agentSessions)
        .set({ status: 'interrupted', endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(agentSessions.id, id));
    }
    const [row] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
    reply.send(row);
  };

  const archiveSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    if (driver.has(id)) {
      // Live: the driver closes the run. Its exit handler writes the session
      // status + ended_at asynchronously, so the row this route returns may
      // still read a running status — the socket's exit frame and the next
      // GET carry the final one.
      driver.stop(id);
    } else if (!session.endedAt) {
      // Not live (e.g. the API restarted under it): finalize the row directly.
      await db
        .update(agentSessions)
        .set({ status: 'interrupted', endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(agentSessions.id, id));
    }
    await db
      .update(agentSessions)
      .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(agentSessions.id, id));
    const [row] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
    reply.send(row);
  };

  const unarchiveSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    await db
      .update(agentSessions)
      .set({ archivedAt: null, updatedAt: sql`now()` })
      .where(eq(agentSessions.id, id));
    const [row] = await db.select().from(agentSessions).where(eq(agentSessions.id, id));
    reply.send(row);
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
      .from(agentAgents)
      .where(isNull(agentAgents.archivedAt))
      .orderBy(desc(agentAgents.createdAt));
    reply.send(rows);
  };

  const createAgent = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createAgentSchema, request.body);
    // Creating an agent creates its owning users(kind='agent') row in the SAME
    // transaction — that is what makes the persona assignable to items and
    // attributable in events with zero ticket-system changes.
    const agent = await db.transaction(async (tx) => {
      const [owner] = await tx
        .insert(users)
        .values({ name: body.name, kind: 'agent' })
        .returning({ id: users.id });
      const [created] = await tx
        .insert(agentAgents)
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
          defaultWorkdirId: body.defaultWorkdirId ?? null,
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
    const [existing] = await db.select().from(agentAgents).where(eq(agentAgents.id, id));
    if (!existing) throw new HttpError(404, 'agent not found');
    const updated = await db.transaction(async (tx) => {
      // Keep the linked users row's name in sync so item attribution matches.
      if (body.name !== undefined) {
        await tx.update(users).set({ name: body.name }).where(eq(users.id, existing.userId));
      }
      const [row] = await tx
        .update(agentAgents)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.model !== undefined ? { model: body.model } : {}),
          ...(body.systemPrompt !== undefined ? { systemPrompt: body.systemPrompt } : {}),
          ...(body.allowedTools !== undefined ? { allowedTools: body.allowedTools } : {}),
          ...(body.disallowedTools !== undefined ? { disallowedTools: body.disallowedTools } : {}),
          ...(body.permissionMode !== undefined ? { permissionMode: body.permissionMode } : {}),
          ...(body.mcpServers !== undefined ? { mcpServers: body.mcpServers } : {}),
          ...(body.effort !== undefined ? { effort: body.effort } : {}),
          ...(body.defaultWorkdirId !== undefined ? { defaultWorkdirId: body.defaultWorkdirId } : {}),
          ...(body.config !== undefined ? { config: body.config } : {}),
          ...(body.archived !== undefined ? { archivedAt: body.archived ? sql`now()` : null } : {}),
        })
        .where(eq(agentAgents.id, id))
        .returning();
      return row;
    });
    reply.send(updated);
  };

  app.get('/api/agent/providers', listProviders);
  app.get('/api/agent/agents', listAgents);
  app.post('/api/agent/agents', createAgent);
  app.patch('/api/agent/agents/:id', patchAgent);
  app.get('/api/agent/sessions', listSessions);
  app.post('/api/agent/sessions', createSession);
  app.get('/api/agent/sessions/:id', getSession);
  app.post('/api/agent/sessions/:id/stop', stopSession);
  app.post('/api/agent/sessions/:id/archive', archiveSession);
  app.post('/api/agent/sessions/:id/unarchive', unarchiveSession);
}
