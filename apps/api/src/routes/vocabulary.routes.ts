import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { fieldCreate, fieldUpdate } from '../command/config/field';
import { parseId } from '../utils/parse-id';

export function registerVocabularyRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.post('/api/types/:typeId/fields', async (request, reply) => {
    const typeId = parseId((request.params as { typeId: string }).typeId);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, fieldCreate, envelope, { itemTypeId: typeId, ...(request.body as object) });
    reply.status(201).send(result);
  });

  app.patch('/api/fields/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, fieldUpdate, envelope, { id, ...(request.body as object) });
    reply.send(result);
  });
}
