import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import { and, eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { ticketLinks, tickets } from '@tickets/db';
import { HttpError } from '../errors';
import { writeEvent } from '../events/write-event';
import { checkLinkCycle } from '../links/check-link-cycle';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';
import { loadProjectVocab } from '../vocab/load-project-vocab';

const createLinkSchema = v.object({
  //
  actorId: v.pipe(v.number(), v.integer()),
  linkTypeKey: v.pipe(v.string(), v.minLength(1)),
  sourceTicketId: v.pipe(v.number(), v.integer()),
  targetTicketId: v.pipe(v.number(), v.integer()),
});

export function registerLinksRoutes(app: FastifyInstance, context: { db: Db }) {
  const { db } = context;

  const createLink = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createLinkSchema, request.body);
    if (body.sourceTicketId === body.targetTicketId) {
      throw new HttpError(422, 'a ticket cannot link to itself');
    }
    const endpoints = await db
      .select({ id: tickets.id, projectId: tickets.projectId })
      .from(tickets)
      .where(eq(tickets.id, body.sourceTicketId));
    const targets = await db
      .select({ id: tickets.id, projectId: tickets.projectId })
      .from(tickets)
      .where(eq(tickets.id, body.targetTicketId));
    const source = endpoints[0];
    const target = targets[0];
    if (!source || !target) {
      throw new HttpError(404, 'source or target ticket not found');
    }
    if (source.projectId !== target.projectId) {
      throw new HttpError(422, 'links cannot cross projects');
    }
    const vocab = await loadProjectVocab(db, { id: source.projectId });
    const linkType = vocab.linkTypeByKey.get(body.linkTypeKey);
    if (!linkType || linkType.archivedAt) {
      throw new HttpError(400, `unknown link type "${body.linkTypeKey}"`);
    }
    const duplicate = await db
      .select({ id: ticketLinks.id })
      .from(ticketLinks)
      .where(
        and(
          eq(ticketLinks.linkTypeId, linkType.id),
          eq(ticketLinks.sourceTicketId, body.sourceTicketId),
          eq(ticketLinks.targetTicketId, body.targetTicketId),
        ),
      );
    if (duplicate[0]) {
      throw new HttpError(409, 'this link already exists');
    }
    if (linkType.directional) {
      await checkLinkCycle(db, {
        linkTypeId: linkType.id,
        sourceTicketId: body.sourceTicketId,
        targetTicketId: body.targetTicketId,
      });
    }
    const created = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(ticketLinks)
        .values({
          linkTypeId: linkType.id,
          sourceTicketId: body.sourceTicketId,
          targetTicketId: body.targetTicketId,
        })
        .returning();
      const link = inserted[0];
      if (!link) {
        throw new HttpError(500, 'link insert returned no row');
      }
      for (const ticketId of [body.sourceTicketId, body.targetTicketId]) {
        await writeEvent(tx, {
          ticketId,
          actorId: body.actorId,
          kind: 'link-added',
          payload: { linkId: link.id, linkTypeKey: linkType.key },
        });
      }
      return link;
    });
    reply.status(201).send(created);
  };

  const deleteLink = async (request: FastifyRequest, reply: FastifyReply) => {
    const id = parseId((request.params as { id: string }).id);
    const actorId = parseId((request.query as { actorId?: string }).actorId);
    const rows = await db.select().from(ticketLinks).where(eq(ticketLinks.id, id));
    const link = rows[0];
    if (!link) {
      throw new HttpError(404, 'link not found');
    }
    await db.transaction(async (tx) => {
      await tx.delete(ticketLinks).where(eq(ticketLinks.id, id));
      for (const ticketId of [link.sourceTicketId, link.targetTicketId]) {
        await writeEvent(tx, {
          ticketId,
          actorId,
          kind: 'link-removed',
          payload: { linkId: link.id },
        });
      }
    });
    reply.send({ deleted: true });
  };

  app.post('/api/links', createLink);
  app.delete('/api/links/:id', deleteLink);
}
