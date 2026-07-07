import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import type { Db } from '@tickets/db';
import { cloneScheme } from '../schemes/clone-scheme';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';

const forkSchema = v.object({
  key: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
});

export function registerSchemesRoutes(app: FastifyInstance, context: { db: Db }) {
  app.post('/api/schemes/:id/fork', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const body = parseBody(forkSchema, request.body);
    const result = await cloneScheme(context.db, id, body);
    reply.status(201).send(result);
  });
}
