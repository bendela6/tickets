import type { FastifyInstance } from 'fastify';
import { asc } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { projects } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { projectCreate } from '../command/config/project';

export function registerProjectsRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;
  app.get('/api/projects', async (_request, reply) => {
    reply.send({ data: await db.select().from(projects).orderBy(asc(projects.id)) });
  });
  app.post('/api/projects', async (request, reply) => {
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, projectCreate, envelope, request.body);
    reply.status(201).send(result);
  });
}
