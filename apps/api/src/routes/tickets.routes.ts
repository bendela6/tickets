import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { Db, DbExecutor } from '@tickets/db';
import { ticketEvents, ticketValues, tickets, users } from '@tickets/db';
import { HttpError } from '../errors';
import { writeEvent } from '../events/write-event';
import { buildValueRows } from '../tickets/build-value-rows';
import { checkParent } from '../tickets/check-parent';
import { checkTransition } from '../tickets/check-transition';
import { nextTicketNumber } from '../tickets/next-ticket-number';
import { renderValue } from '../tickets/render-value';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';
import { loadProjectVocab, type ProjectVocab } from '../vocab/load-project-vocab';

const createTicketSchema = v.object({
  //
  actorId: v.pipe(v.number(), v.integer()),
  typeKey: v.pipe(v.string(), v.minLength(1)),
  parentId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  values: v.record(v.string(), v.unknown()),
});

const patchTicketSchema = v.strictObject({
  //
  actorId: v.pipe(v.number(), v.integer()),
  expectedUpdatedAt: v.pipe(v.string(), v.minLength(1)),
  parentId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  archived: v.optional(v.boolean()),
  values: v.optional(v.record(v.string(), v.unknown())),
});

async function currentFieldValue(
  tx: DbExecutor,
  vocab: ProjectVocab,
  ticketId: number,
  fieldId: number,
) {
  const rows = await tx
    .select()
    .from(ticketValues)
    .where(and(eq(ticketValues.ticketId, ticketId), eq(ticketValues.fieldId, fieldId)));
  if (rows.length === 0) {
    return { rows, rendered: null };
  }
  const rendered =
    rows.length === 1 ? renderValue(vocab, rows[0]!) : rows.map((row) => renderValue(vocab, row));
  return { rows, rendered };
}

export function registerTicketsRoutes(app: FastifyInstance, context: { db: Db }) {
  const { db } = context;

  const createTicket = async (request: FastifyRequest, reply: FastifyReply) => {
    const { key } = request.params as { key: string };
    const body = parseBody(createTicketSchema, request.body);
    const vocab = await loadProjectVocab(db, { key });
    const type = vocab.typeByKey.get(body.typeKey);
    if (!type || type.archivedAt) {
      throw new HttpError(400, `unknown ticket type "${body.typeKey}"`);
    }

    // required gates creation: every required field of the type needs a value
    const requiredFieldIds = vocab.typeFields
      .filter((row) => row.ticketTypeId === type.id && row.required)
      .map((row) => row.fieldId);
    for (const fieldId of requiredFieldIds) {
      const field = vocab.fieldById.get(fieldId);
      const value = field ? body.values[field.key] : undefined;
      if (value === undefined || value === null || value === '') {
        throw new HttpError(400, `field "${field?.key}" is required for type "${type.key}"`);
      }
    }

    // default the status to the project's initial one when the type has a
    // status field and the caller did not choose
    const statusField = vocab.fields.find((field) => field.type === 'status');
    const values = { ...body.values };
    if (statusField && values[statusField.key] === undefined) {
      const initial =
        vocab.statuses.find(
          (status) => (status.config as { initial?: boolean }).initial === true,
        ) ?? vocab.statuses[0];
      if (initial) {
        values[statusField.key] = initial.key;
      }
    }

    if (body.parentId !== undefined && body.parentId !== null) {
      await checkParent(db, {
        ticketId: null,
        parentId: body.parentId,
        projectId: vocab.project.id,
      });
    }

    const created = await db.transaction(async (tx) => {
      const number = await nextTicketNumber(tx, vocab.project.id);
      const inserted = await tx
        .insert(tickets)
        .values({
          projectId: vocab.project.id,
          typeId: type.id,
          parentId: body.parentId ?? null,
          number,
          createdBy: body.actorId,
        })
        .returning();
      const ticket = inserted[0];
      if (!ticket) {
        throw new HttpError(500, 'ticket insert returned no row');
      }
      for (const [fieldKey, value] of Object.entries(values)) {
        const rows = buildValueRows(vocab, fieldKey, value);
        const field = vocab.fieldByKey.get(fieldKey);
        if (field?.type === 'status' && rows[0]?.statusId) {
          checkTransition(vocab, {
            fromStatusId: null,
            toStatusId: rows[0].statusId,
            typeId: type.id,
          });
        }
        if (rows.length > 0) {
          await tx
            .insert(ticketValues)
            .values(rows.map((row) => ({ ...row, ticketId: ticket.id })));
        }
      }
      await writeEvent(tx, {
        ticketId: ticket.id,
        actorId: body.actorId,
        kind: 'created',
        payload: { values },
      });
      return ticket;
    });
    reply.status(201).send(created);
  };

  const patchTicket = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const body = parseBody(patchTicketSchema, request.body);
    const existingRows = await db.select().from(tickets).where(eq(tickets.id, id));
    const existing = existingRows[0];
    if (!existing) {
      throw new HttpError(404, 'ticket not found');
    }
    const vocab = await loadProjectVocab(db, { id: existing.projectId });

    const updated = await db.transaction(async (tx) => {
      // optimistic lock: the touch only lands if nobody moved updated_at
      const touched = await tx
        .update(tickets)
        .set({ updatedAt: sql`clock_timestamp()` })
        .where(and(eq(tickets.id, id), sql`${tickets.updatedAt}::text = ${body.expectedUpdatedAt}`))
        .returning();
      const ticket = touched[0];
      if (!ticket) {
        throw new HttpError(409, 'ticket changed since you loaded it — refresh and retry');
      }

      // ticket type is immutable: typeId only ever comes from the loaded row
      const typeId = ticket.typeId;

      if (body.parentId !== undefined && body.parentId !== ticket.parentId) {
        if (body.parentId !== null) {
          await checkParent(tx, {
            ticketId: id,
            parentId: body.parentId,
            projectId: existing.projectId,
          });
        }
        await tx.update(tickets).set({ parentId: body.parentId }).where(eq(tickets.id, id));
        await writeEvent(tx, {
          ticketId: id,
          actorId: body.actorId,
          kind: 'parent-changed',
          payload: { from: ticket.parentId, to: body.parentId },
        });
      }

      if (body.archived !== undefined) {
        const archivedAt = body.archived ? sql`now()` : null;
        await tx.update(tickets).set({ archivedAt }).where(eq(tickets.id, id));
        await writeEvent(tx, {
          ticketId: id,
          actorId: body.actorId,
          kind: body.archived ? 'archived' : 'unarchived',
        });
      }

      for (const [fieldKey, value] of Object.entries(body.values ?? {})) {
        const field = vocab.fieldByKey.get(fieldKey);
        if (!field || field.archivedAt) {
          throw new HttpError(400, `unknown field "${fieldKey}"`);
        }
        const current = await currentFieldValue(tx, vocab, id, field.id);
        const nextRows = buildValueRows(vocab, fieldKey, value);

        if (field.type === 'status') {
          const nextStatusId = nextRows[0]?.statusId;
          if (!nextStatusId) {
            throw new HttpError(400, 'status cannot be cleared');
          }
          const fromStatusId = current.rows[0]?.statusId ?? null;
          if (fromStatusId === nextStatusId) {
            continue;
          }
          checkTransition(vocab, { fromStatusId, toStatusId: nextStatusId, typeId });
        }

        // replace semantics keep single-select single even though the DB
        // cannot enforce it for option-carrying rows
        await tx
          .delete(ticketValues)
          .where(and(eq(ticketValues.ticketId, id), eq(ticketValues.fieldId, field.id)));
        if (nextRows.length > 0) {
          await tx.insert(ticketValues).values(nextRows.map((row) => ({ ...row, ticketId: id })));
        }
        const rendered = nextRows.length === 0 ? null : value;
        await writeEvent(tx, {
          ticketId: id,
          actorId: body.actorId,
          kind: field.type === 'status' ? 'status-changed' : 'value-changed',
          payload: { fieldId: field.id, fieldKey, from: current.rendered, to: rendered },
        });
      }

      const finalRows = await tx.select().from(tickets).where(eq(tickets.id, id));
      return finalRows[0];
    });

    reply.send({ id: updated?.id, updatedAt: updated?.updatedAt });
  };

  const listTicketEvents = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const query = request.query as { skip?: string; take?: string };
    const skip = Math.max(0, Number(query.skip ?? 0) || 0);
    const take = Math.min(200, Math.max(1, Number(query.take ?? 50) || 50));
    const [rows, totalRows] = await Promise.all([
      db
        .select({
          id: ticketEvents.id,
          ticketId: ticketEvents.ticketId,
          actorId: ticketEvents.actorId,
          actorName: users.name,
          kind: ticketEvents.kind,
          payload: ticketEvents.payload,
          createdAt: ticketEvents.createdAt,
        })
        .from(ticketEvents)
        .innerJoin(users, eq(users.id, ticketEvents.actorId))
        .where(eq(ticketEvents.ticketId, id))
        .orderBy(desc(ticketEvents.createdAt), desc(ticketEvents.id))
        .offset(skip)
        .limit(take),
      db.select({ value: count() }).from(ticketEvents).where(eq(ticketEvents.ticketId, id)),
    ]);
    reply.send({
      data: rows,
      meta: { skip, take, total: totalRows[0]?.value ?? 0, sort: '-createdAt' },
    });
  };

  app.post('/api/projects/:key/tickets', createTicket);
  app.patch('/api/tickets/:id', patchTicket);
  app.get('/api/tickets/:id/events', listTicketEvents);
}
