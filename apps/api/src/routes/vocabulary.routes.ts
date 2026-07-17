import type { FastifyInstance } from 'fastify';
import type { Db } from '@tickets/db';
import { parseEnvelope } from '../command/envelope';
import { runCommand } from '../command/run-command';
import { fieldCreate, fieldUpdate } from '../command/config/field';
import { fieldPlace, fieldUnplace, placementUpdate } from '../command/config/placement';
import { optionCreate, optionUpdate } from '../command/config/option';
import { transitionCreate, transitionDelete } from '../command/config/transition';
import { linkTypeCreate, linkTypeSetTargetTypes, linkTypeUpdate } from '../command/config/link-type';
import { typeCreate, typeSetChildTypes, typeUpdate } from '../command/config/type';
import { parseId } from '../utils/parse-id';

export function registerVocabularyRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.post('/api/types/:typeId/fields', async (request, reply) => {
    const typeId = parseId((request.params as { typeId: string }).typeId);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, fieldCreate, envelope, { ...(request.body as object), itemTypeId: typeId });
    reply.status(201).send(result);
  });

  app.patch('/api/fields/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, fieldUpdate, envelope, { ...(request.body as object), id });
    reply.send(result);
  });

  app.post('/api/fields/:id/options', async (request, reply) => {
    const fieldId = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, optionCreate, envelope, { ...(request.body as object), fieldId });
    reply.status(201).send(result);
  });

  app.patch('/api/options/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, optionUpdate, envelope, { ...(request.body as object), id });
    reply.send(result);
  });

  app.post('/api/fields/:id/transitions', async (request, reply) => {
    const fieldId = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, transitionCreate, envelope, { ...(request.body as object), fieldId });
    reply.status(201).send(result);
  });

  app.delete('/api/transitions/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, transitionDelete, envelope, { id });
    reply.send(result);
  });

  app.post('/api/types/:typeId/link-types', async (request, reply) => {
    const typeId = parseId((request.params as { typeId: string }).typeId);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, linkTypeCreate, envelope, { ...(request.body as object), itemTypeId: typeId });
    reply.status(201).send(result);
  });

  app.patch('/api/link-types/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, linkTypeUpdate, envelope, { ...(request.body as object), id });
    reply.send(result);
  });
  app.put('/api/link-types/:id/target-types', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, linkTypeSetTargetTypes, envelope, { ...(request.body as object), linkTypeId: id });
    reply.send(result);
  });

  app.post('/api/types/:typeId/fields/:fieldId/placement', async (request, reply) => {
    const p = request.params as { typeId: string; fieldId: string };
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, fieldPlace, envelope, { ...(request.body as object), itemTypeId: parseId(p.typeId), fieldId: parseId(p.fieldId) });
    reply.status(201).send(result);
  });
  app.delete('/api/types/:typeId/fields/:fieldId/placement', async (request, reply) => {
    const p = request.params as { typeId: string; fieldId: string };
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, fieldUnplace, envelope, { itemTypeId: parseId(p.typeId), fieldId: parseId(p.fieldId) });
    reply.send(result);
  });
  app.patch('/api/types/:typeId/fields/:fieldId/placement', async (request, reply) => {
    const p = request.params as { typeId: string; fieldId: string };
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, placementUpdate, envelope, { ...(request.body as object), itemTypeId: parseId(p.typeId), fieldId: parseId(p.fieldId) });
    reply.send(result);
  });

  app.post('/api/types', async (request, reply) => {
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, typeCreate, envelope, request.body);
    reply.status(201).send(result);
  });
  app.patch('/api/types/:id', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, typeUpdate, envelope, { ...(request.body as object), id });
    reply.send(result);
  });
  app.put('/api/types/:id/child-types', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const envelope = parseEnvelope(request.body);
    const result = await runCommand(db, typeSetChildTypes, envelope, { ...(request.body as object), typeId: id });
    reply.send(result);
  });
}
