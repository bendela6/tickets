import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { itemActivityFeed, projectActivityFeed } from '../read/activity';
import { parseId } from '../utils/parse-id';

export function registerActivityRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.get('/api/items/:id/activity', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    reply.send(await itemActivityFeed(db, id));
  });

  app.get('/api/projects/:id/activity', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    reply.send(await projectActivityFeed(db, id));
  });
}
