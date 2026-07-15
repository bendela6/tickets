import type { FastifyInstance } from 'fastify';
import { asc } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { users } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { userCreate } from '../command/config/user';

export function registerUsersRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;
  app.get('/api/users', async (_request, reply) => {
    reply.send({ data: await db.select().from(users).orderBy(asc(users.id)) });
  });
  app.post('/api/users', async (request, reply) => {
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, userCreate, envelope, request.body);
    reply.status(201).send(result);
  });
}
