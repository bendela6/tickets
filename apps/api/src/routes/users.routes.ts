import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { ensureUser, users } from '@tickets/db';
import { parseBody } from '../utils/parse-body';

const createUserSchema = v.object({
  //
  name: v.pipe(v.string(), v.minLength(1)),
  kind: v.optional(v.picklist(['human', 'agent'])),
});

export function registerUsersRoutes(app: FastifyInstance, context: { db: Db }) {
  const { db } = context;

  const listUsers = async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await db.select().from(users);
    reply.send({
      data: rows,
      meta: { skip: 0, take: rows.length, total: rows.length, sort: null },
    });
  };

  const createUser = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createUserSchema, request.body);
    const id = await ensureUser(db, { name: body.name, kind: body.kind ?? 'human' });
    const rows = await db.select().from(users).where(eq(users.id, id));
    reply.status(201).send(rows[0]);
  };

  app.get('/api/users', listUsers);
  app.post('/api/users', createUser);
}
