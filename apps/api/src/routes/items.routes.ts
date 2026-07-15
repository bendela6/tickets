import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { itemComment } from '../command/item/comment';
import { itemCreate } from '../command/item/create';
import { itemUpdate } from '../command/item/update';
import { parseId } from '../utils/parse-id';

export function registerItemsRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.post('/api/projects/:key/items', async (request, reply) => {
    const { key } = request.params as { key: string };
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, itemCreate, envelope, { ...(request.body as object), projectKey: key });
    reply.status(201).send(result);
  });

  app.patch('/api/items/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, itemUpdate, envelope, { ...(request.body as object), id });
    reply.send(result);
  });

  app.post('/api/items/:id/comments', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, itemComment, envelope, { ...(request.body as object), itemId: id });
    reply.status(201).send(result);
  });
}
