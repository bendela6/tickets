import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import type { Db } from '@tickets/db';
import { terminalSessions, workdirs } from '@tickets/db';
import { HttpError } from '../errors';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';
import type { TerminalDriver } from './driver';
import { resolveSessionCommand } from './session-command';
import { assertWorkspaceDir } from './workspace-fs';

const runnerSchema = v.picklist(['local', 'container']);

// Minimal workdir CRUD — just enough to create a workdir a terminal session
// can run in. `/api/ai/workspaces` remains the full CRUD home over the same
// `core.workdirs` table until Task 9 formalises one wire surface.
const createWorkdirSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  path: v.pipe(v.string(), v.minLength(1)),
  runner: v.optional(runnerSchema),
  containerName: v.optional(v.string()),
  gitRemote: v.optional(v.string()),
  defaultBranch: v.optional(v.string()),
  config: v.optional(v.record(v.string(), v.unknown())),
});

const createSessionSchema = v.object({
  workdirId: v.pipe(v.number(), v.integer()),
  title: v.optional(v.pipe(v.string(), v.minLength(1))),
  command: v.optional(v.string()),
  cols: v.optional(v.pipe(v.number(), v.integer())),
  rows: v.optional(v.pipe(v.number(), v.integer())),
});

export function registerTerminalRoutes(
  app: FastifyInstance,
  context: { db: Db; driver: TerminalDriver },
): void {
  const { db, driver } = context;

  // ── Workdirs ─────────────────────────────────────────────────────────────

  const createWorkdir = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createWorkdirSchema, request.body);
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

  const listWorkdirs = async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await db
      .select()
      .from(workdirs)
      .where(isNull(workdirs.archivedAt))
      .orderBy(desc(workdirs.createdAt));
    reply.send(rows);
  };

  // ── Sessions ─────────────────────────────────────────────────────────────

  // Load + validate a workdir before we insert a row or spawn anything: a bad
  // id is a 404 and a typo'd path a 400, never a session that dies immediately.
  const loadRunnableWorkdir = async (workdirId: number) => {
    const [wd] = await db.select().from(workdirs).where(eq(workdirs.id, workdirId));
    if (!wd) throw new HttpError(404, 'workdir not found');
    if (wd.runner === 'container') {
      throw new HttpError(400, 'container runner is not supported yet');
    }
    await assertWorkspaceDir(wd.path);
    return wd;
  };

  const listSessions = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: string; archived?: string };
    const conditions = [];
    if (query.status) conditions.push(eq(terminalSessions.status, query.status as never));
    if (query.archived !== 'true') conditions.push(isNull(terminalSessions.archivedAt));
    const rows = await db
      .select()
      .from(terminalSessions)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(terminalSessions.createdAt));
    reply.send(rows);
  };

  const createSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createSessionSchema, request.body);
    const workdir = await loadRunnableWorkdir(body.workdirId);
    const cmd = resolveSessionCommand(body.command);
    const [session] = await db
      .insert(terminalSessions)
      .values({
        title: body.title ?? cmd.command,
        workdirId: workdir.id,
        status: 'starting',
        cwd: workdir.path,
      })
      .returning();

    driver.start({
      id: session!.id,
      command: cmd.command,
      args: cmd.args,
      cwd: workdir.path,
      cols: body.cols,
      rows: body.rows,
    });

    reply.status(201).send(session);
  };

  const getSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(terminalSessions).where(eq(terminalSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    reply.send(session);
  };

  const archiveSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(terminalSessions).where(eq(terminalSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    if (driver.has(id)) {
      // Live: the driver kills the PTY; its exit handler writes the terminal
      // status + ended_at, so we do not race it here.
      driver.stop(id);
    } else if (!session.endedAt) {
      // Not live (e.g. the API restarted under it): finalize the row directly.
      await db
        .update(terminalSessions)
        .set({ status: 'disconnected', endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(terminalSessions.id, id));
    }
    await db
      .update(terminalSessions)
      .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(terminalSessions.id, id));
    const [row] = await db.select().from(terminalSessions).where(eq(terminalSessions.id, id));
    reply.send(row);
  };

  const unarchiveSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(terminalSessions).where(eq(terminalSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    await db
      .update(terminalSessions)
      .set({ archivedAt: null, updatedAt: sql`now()` })
      .where(eq(terminalSessions.id, id));
    const [row] = await db.select().from(terminalSessions).where(eq(terminalSessions.id, id));
    reply.send(row);
  };

  app.post('/api/workdirs', createWorkdir);
  app.get('/api/workdirs', listWorkdirs);
  app.get('/api/terminal/sessions', listSessions);
  app.post('/api/terminal/sessions', createSession);
  app.get('/api/terminal/sessions/:id', getSession);
  app.post('/api/terminal/sessions/:id/archive', archiveSession);
  app.post('/api/terminal/sessions/:id/unarchive', unarchiveSession);
}
