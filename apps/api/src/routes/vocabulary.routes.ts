import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import { count, eq, sql } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { fieldOptions, fields, statusTransitions, statuses } from '@tickets/db';
import { HttpError } from '../errors';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';
import { createFieldForType } from '../vocab/create-field';
import { createLinkTypeForType } from '../vocab/create-link-type';
import { loadProjectVocab } from '../vocab/load-project-vocab';

const createFieldSchema = v.object({
  //
  key: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  type: v.picklist([
    'text',
    'number',
    'date',
    'boolean',
    'json',
    'select',
    'multi_select',
    'status',
  ]),
  required: v.optional(v.boolean()),
  config: v.optional(v.record(v.string(), v.unknown())),
});

const patchArchivableSchema = v.object({
  //
  label: v.optional(v.pipe(v.string(), v.minLength(1))),
  config: v.optional(v.record(v.string(), v.unknown())),
  archived: v.optional(v.boolean()),
});

const createOptionSchema = v.object({
  //
  value: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  config: v.optional(v.record(v.string(), v.unknown())),
});

const createStatusSchema = v.object({
  //
  ticketTypeKey: v.pipe(v.string(), v.minLength(1)),
  key: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  kind: v.picklist(['todo', 'active', 'blocked', 'done', 'dropped']),
  config: v.optional(v.record(v.string(), v.unknown())),
});

const createTransitionSchema = v.object({
  //
  fromStatusKey: v.nullable(v.string()),
  toStatusKey: v.pipe(v.string(), v.minLength(1)),
  ticketTypeKey: v.optional(v.nullable(v.string())),
});

const createLinkTypeSchema = v.object({
  //
  key: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  inverseLabel: v.pipe(v.string(), v.minLength(1)),
  directional: v.boolean(),
  targetTypeKeys: v.array(v.pipe(v.string(), v.minLength(1))),
});

export function registerVocabularyRoutes(app: FastifyInstance, context: { db: Db }) {
  const { db } = context;

  const createField = async (request: FastifyRequest, reply: FastifyReply) => {
    const typeId = parseId((request.params as { typeId: string }).typeId);
    const body = parseBody(createFieldSchema, request.body);
    const created = await createFieldForType(db, typeId, body);
    reply.status(201).send(created);
  };

  const patchField = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const body = parseBody(patchArchivableSchema, request.body);
    const rows = await db.select().from(fields).where(eq(fields.id, id));
    const field = rows[0];
    if (!field) {
      throw new HttpError(404, 'field not found');
    }
    if (field.system && body.archived) {
      throw new HttpError(422, 'system fields cannot be archived');
    }
    const updated = await db
      .update(fields)
      .set({
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.config !== undefined ? { config: body.config } : {}),
        ...(body.archived !== undefined ? { archivedAt: body.archived ? sql`now()` : null } : {}),
      })
      .where(eq(fields.id, id))
      .returning();
    reply.send(updated[0]);
  };

  const createOption = async (request: FastifyRequest, reply: FastifyReply) => {
    const fieldId = parseId((request.params as { id: string }).id);
    const body = parseBody(createOptionSchema, request.body);
    const fieldRows = await db.select().from(fields).where(eq(fields.id, fieldId));
    const field = fieldRows[0];
    if (!field) {
      throw new HttpError(404, 'field not found');
    }
    if (field.type !== 'select' && field.type !== 'multi_select') {
      throw new HttpError(422, `field "${field.key}" does not take options`);
    }
    const positionRows = await db
      .select({ value: count() })
      .from(fieldOptions)
      .where(eq(fieldOptions.fieldId, fieldId));
    const inserted = await db
      .insert(fieldOptions)
      .values({
        fieldId,
        value: body.value,
        label: body.label,
        config: body.config ?? {},
        position: positionRows[0]?.value ?? 0,
      })
      .returning();
    reply.status(201).send(inserted[0]);
  };

  const patchOption = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const body = parseBody(patchArchivableSchema, request.body);
    const updated = await db
      .update(fieldOptions)
      .set({
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.config !== undefined ? { config: body.config } : {}),
        ...(body.archived !== undefined ? { archivedAt: body.archived ? sql`now()` : null } : {}),
      })
      .where(eq(fieldOptions.id, id))
      .returning();
    if (!updated[0]) {
      throw new HttpError(404, 'option not found');
    }
    reply.send(updated[0]);
  };

  const createStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const body = parseBody(createStatusSchema, request.body);
    const vocab = await loadProjectVocab(db, { key });
    const type = vocab.typeByKey.get(body.ticketTypeKey);
    if (!type) {
      throw new HttpError(400, `unknown ticket type "${body.ticketTypeKey}"`);
    }
    const typeStatusCount = vocab.statuses.filter((s) => s.ticketTypeId === type.id).length;
    const inserted = await db
      .insert(statuses)
      .values({
        ticketTypeId: type.id,
        key: body.key,
        label: body.label,
        kind: body.kind,
        config: body.config ?? {},
        position: typeStatusCount,
      })
      .returning();
    reply.status(201).send(inserted[0]);
  };

  const patchStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const body = parseBody(patchArchivableSchema, request.body);
    const updated = await db
      .update(statuses)
      .set({
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.config !== undefined ? { config: body.config } : {}),
        ...(body.archived !== undefined ? { archivedAt: body.archived ? sql`now()` : null } : {}),
      })
      .where(eq(statuses.id, id))
      .returning();
    if (!updated[0]) {
      throw new HttpError(404, 'status not found');
    }
    reply.send(updated[0]);
  };

  const createTransition = async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const body = parseBody(createTransitionSchema, request.body);
    const vocab = await loadProjectVocab(db, { key });
    if (!body.ticketTypeKey) {
      throw new HttpError(400, 'ticketTypeKey is required (statuses are type-owned)');
    }
    const type = vocab.typeByKey.get(body.ticketTypeKey);
    if (!type) {
      throw new HttpError(400, `unknown ticket type "${body.ticketTypeKey}"`);
    }
    const resolveStatus = (statusKey: string) => {
      const status = vocab.statusByTypeKey.get(`${type.id}:${statusKey}`);
      if (!status) {
        throw new HttpError(400, `unknown status "${statusKey}" for type "${type.key}"`);
      }
      return status;
    };
    const fromStatusId = body.fromStatusKey === null ? null : resolveStatus(body.fromStatusKey).id;
    const toStatusId = resolveStatus(body.toStatusKey).id;
    const inserted = await db
      .insert(statusTransitions)
      .values({ fromStatusId, toStatusId, ticketTypeId: type.id })
      .returning();
    reply.status(201).send(inserted[0]);
  };

  const deleteTransition = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const deleted = await db
      .delete(statusTransitions)
      .where(eq(statusTransitions.id, id))
      .returning();
    if (!deleted[0]) {
      throw new HttpError(404, 'transition not found');
    }
    reply.send({ deleted: true });
  };

  const createLinkType = async (request: FastifyRequest, reply: FastifyReply) => {
    const typeId = parseId((request.params as { typeId: string }).typeId);
    const body = parseBody(createLinkTypeSchema, request.body);
    const created = await createLinkTypeForType(db, typeId, body);
    reply.status(201).send(created);
  };

  app.post('/api/types/:typeId/fields', createField);
  app.patch('/api/fields/:id', patchField);
  app.post('/api/fields/:id/options', createOption);
  app.patch('/api/options/:id', patchOption);
  app.post('/api/projects/:key/statuses', createStatus);
  app.patch('/api/statuses/:id', patchStatus);
  app.post('/api/projects/:key/status-transitions', createTransition);
  app.delete('/api/status-transitions/:id', deleteTransition);
  app.post('/api/types/:typeId/link-types', createLinkType);
}
