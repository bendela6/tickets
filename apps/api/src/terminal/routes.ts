import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import type { Db } from '@tickets/db';
import { terminalSessions } from '@tickets/db';
import { HttpError } from '../errors';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';
import { parseQuery } from '../utils/parse-query';
import { loadRunnableWorkdir } from '../workdir/load-workdir';
import type { TerminalDriver } from './driver';
import { resolveSessionCommand } from './session-command';

// `terminal.session_status`, in full. `?status=` is user input and reaches a
// WHERE clause: unvalidated, a bogus value went to Postgres as an enum literal
// and came back as invalid-enum-input — a 500 for what is a bad request.
// These are the terminal's OWN statuses; the agent schema's enum shares the
// name and neither may drift into the other.
const statusSchema = v.picklist(['starting', 'live', 'disconnected', 'exited', 'failed']);

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

  // ── Sessions ─────────────────────────────────────────────────────────────

  const listSessions = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { status?: string; archived?: string };
    const conditions = [];
    if (query.status) conditions.push(eq(terminalSessions.status, parseQuery(statusSchema, query.status)));
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
    const workdir = await loadRunnableWorkdir(db, body.workdirId);
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

  // End the session without hiding it. Stop and archive are two different
  // acts: stopping kills the PTY and finalizes the row, and the session stays
  // in the list as `exited`/`disconnected` for the user to read the output;
  // archiving is what takes it off the list. Folding the two together would
  // mean a session could only be ended by making it disappear — and would
  // leave the terminal enum's `exited` reachable only via a route that
  // immediately hides the row. (`archived_at` stays NULL here; see
  // archiveSession below, which is this body plus the archive UPDATE.)
  const stopSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(terminalSessions).where(eq(terminalSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    if (driver.has(id)) {
      driver.stop(id);
    } else if (!session.endedAt) {
      await db
        .update(terminalSessions)
        .set({ status: 'disconnected', endedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(terminalSessions.id, id));
    }
    const [row] = await db.select().from(terminalSessions).where(eq(terminalSessions.id, id));
    reply.send(row);
  };

  const archiveSession = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const [session] = await db.select().from(terminalSessions).where(eq(terminalSessions.id, id));
    if (!session) throw new HttpError(404, 'session not found');
    if (driver.has(id)) {
      // Live: the driver kills the PTY. Its exit handler writes the terminal
      // status + ended_at asynchronously, so the row this route returns may
      // still read `live` — the socket's exit frame and the next GET carry
      // the final status.
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

  app.get('/api/terminal/sessions', listSessions);
  app.post('/api/terminal/sessions', createSession);
  app.get('/api/terminal/sessions/:id', getSession);
  app.post('/api/terminal/sessions/:id/stop', stopSession);
  app.post('/api/terminal/sessions/:id/archive', archiveSession);
  app.post('/api/terminal/sessions/:id/unarchive', unarchiveSession);
}
