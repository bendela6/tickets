import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { commentDelete, itemComment } from '../command/item/comment';
import { itemCreate } from '../command/item/create';
import { itemUpdate } from '../command/item/update';
import { itemByKey } from '../read/item-by-key';
import { parseId } from '../utils/parse-id';

export function registerItemsRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.post('/api/projects/:key/items', async (request, reply) => {
    const { key } = request.params as { key: string };
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, itemCreate, envelope, { ...(request.body as object), projectKey: key });
    reply.status(201).send(result);
  });

  // An item by its key. An epic's key has a slash (`TK/E14`): sent encoded
  // (`TK%2FE14`) or as it is, the wildcard takes the rest of the path.
  app.get('/api/items/by-key/*', async (request, reply) => {
    const key = (request.params as { '*': string })['*'];
    reply.send(await itemByKey(db, key));
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

  // Only its author deletes a comment (the envelope's actorId); see commentDelete.
  app.delete('/api/comments/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, commentDelete, envelope, { id });
    reply.send(result);
  });
}
