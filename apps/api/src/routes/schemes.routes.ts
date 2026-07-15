import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { schemeFork } from '../command/config/scheme';
import { parseId } from '../utils/parse-id';

export function registerSchemesRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;
  app.post('/api/schemes/:id/fork', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, schemeFork, envelope, { ...(request.body as object), sourceSchemeId: id });
    reply.status(201).send(result);
  });
}
