import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { itemCreate } from '../command/item/create';

export function registerItemsRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.post('/api/projects/:key/items', async (request, reply) => {
    const { key } = request.params as { key: string };
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, itemCreate, envelope, { projectKey: key, ...(request.body as object) });
    reply.status(201).send(result);
  });
}
