import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { viewCreate, viewUpdate } from '../command/config/view';
import { parseId } from '../utils/parse-id';

export function registerViewsRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;
  app.post('/api/projects/:key/views', async (request, reply) => {
    const { key } = request.params as { key: string };
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, viewCreate, envelope, { ...(request.body as object), projectKey: key });
    reply.status(201).send(result);
  });
  app.patch('/api/views/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, viewUpdate, envelope, { ...(request.body as object), id });
    reply.send(result);
  });
}
