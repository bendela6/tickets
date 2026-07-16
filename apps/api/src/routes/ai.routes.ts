import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { aiSessions, aiWorkspaces } from '@tickets/db';
import { assertWorkspaceDir } from '../ai/workspace-fs';
import { resolveSessionCommand } from '../ai/session-command';
import type { Supervisor } from '../ai/supervisor';
import { HttpError } from '../errors';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';

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
  // E1 is terminal-only; the enum has 'agent' but the route rejects it until E2.
  kind: v.optional(v.picklist(['terminal', 'agent'])),
  workspaceId: v.pipe(v.number(), v.integer()),
  title: v.optional(v.pipe(v.string(), v.minLength(1))),
  command: v.optional(v.string()),
  cols: v.optional(v.pipe(v.number(), v.integer())),
  rows: v.optional(v.pipe(v.number(), v.integer())),
});

export function registerAiRoutes(
  app: FastifyInstance,
  context: { db: Db; supervisor: Supervisor },
) {
  const { db, supervisor } = context;

  // ── Workspaces ─────────────────────────────────────────────────────────────

  const listWorkspaces = async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await db
      .select()
      .from(aiWorkspaces)
      .where(isNull(aiWorkspaces.archivedAt))
      .orderBy(desc(aiWorkspaces.createdAt));
    reply.send(rows);
  };

  const createWorkspace = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createWorkspaceSchema, request.body);
    const inserted = await db
      .insert(aiWorkspaces)
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
    const [existing] = await db.select().from(aiWorkspaces).where(eq(aiWorkspaces.id, id));
    if (!existing) throw new HttpError(404, 'workspace not found');
    const updated = await db
      .update(aiWorkspaces)
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
      .where(eq(aiWorkspaces.id, id))
      .returning();
    reply.send(updated[0]);
  };

  // ── Sessions ───────────────────────────────────────────────────────────────

  const listSessions = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: string; kind?: string };
    const conditions = [];
    if (query.status) conditions.push(eq(aiSessions.status, query.status as never));
    if (query.kind) conditions.push(eq(aiSessions.kind, query.kind as never));
    const rows = await db
      .select()
      .from(aiSessions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(aiSessions.createdAt));
    reply.send(rows);
  };

  const createSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createSessionSchema, request.body);
    if (body.kind && body.kind !== 'terminal') {
      throw new HttpError(400, 'only terminal sessions are supported until E2');
    }
    const [workspace] = await db
      .select()
      .from(aiWorkspaces)
      .where(eq(aiWorkspaces.id, body.workspaceId));
    if (!workspace) throw new HttpError(404, 'workspace not found');
    if (workspace.runner === 'container') {
      throw new HttpError(400, 'container runner is not supported until E2');
    }
    // Validate the path BEFORE inserting a row or spawning — a typo is a 400, not
    // a session that dies a moment after it is created.
    await assertWorkspaceDir(workspace.path);

    const cmd = resolveSessionCommand(body.command);
    const [session] = await db
      .insert(aiSessions)
      .values({
        kind: 'terminal',
        title: body.title ?? cmd.command,
        workspaceId: workspace.id,
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

    reply.status(201).send(session);
  };

  const getSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(aiSessions).where(eq(aiSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    reply.send(session);
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

  app.get('/api/ai/workspaces', listWorkspaces);
  app.post('/api/ai/workspaces', createWorkspace);
  app.patch('/api/ai/workspaces/:id', patchWorkspace);
  app.get('/api/ai/sessions', listSessions);
  app.post('/api/ai/sessions', createSession);
  app.get('/api/ai/sessions/:id', getSession);
  app.delete('/api/ai/sessions/:id', stopSession);
}
