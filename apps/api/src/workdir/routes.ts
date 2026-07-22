import { desc, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import type { Db } from '@tickets/db';
import { workdirs } from '@tickets/db';
import { parseBody } from '../utils/parse-body';
import { listRoots, listSubdirs } from './workdir-fs';

// `core.workdirs` is a CORE concept, not an AI one: a directory a process can
// run in. Both the terminal and the agent subsystem need one, so its CRUD
// lives HERE rather than inside either driver — registering it from one of
// them would make unmounting that one break the other, which is exactly the
// independence this split exists to buy. (The old `/api/ai/workspaces` route
// is gone with the rest of `apps/api/src/ai/`.)
const runnerSchema = v.picklist(['local', 'container']);

const createWorkdirSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  path: v.pipe(v.string(), v.minLength(1)),
  runner: v.optional(runnerSchema),
  containerName: v.optional(v.string()),
  gitRemote: v.optional(v.string()),
  defaultBranch: v.optional(v.string()),
  config: v.optional(v.record(v.string(), v.unknown())),
});

const dirsQuerySchema = v.object({ path: v.pipe(v.string(), v.minLength(1)) });

export function registerWorkdirRoutes(app: FastifyInstance, context: { db: Db }): void {
  const { db } = context;

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

  const getRoots = async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.send(listRoots());
  };

  const getDirs = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(dirsQuerySchema, request.query); // throws HttpError(400) if path missing/blank
    reply.send(await listSubdirs(query.path));
  };

  app.post('/api/workdirs', createWorkdir);
  app.get('/api/workdirs', listWorkdirs);
  app.get('/api/workdirs/roots', getRoots);
  app.get('/api/workdirs/dirs', getDirs);
}
