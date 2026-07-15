import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { itemLink, itemUnlink } from '../command/item/link';
import { parseId } from '../utils/parse-id';

export function registerLinksRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;
  app.post('/api/links', async (request, reply) => {
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, itemLink, envelope, request.body);
    reply.status(201).send(result);
  });
  app.delete('/api/links/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, itemUnlink, envelope, { id });
    reply.send(result);
  });
}
