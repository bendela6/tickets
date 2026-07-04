import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { comments, tickets } from '@tickets/db';
import { HttpError } from '../errors';
import { writeEvent } from '../events/write-event';
import { parseBody } from '../utils/parse-body';
import { parseId } from '../utils/parse-id';

const createCommentSchema = v.object({
  //
  authorId: v.pipe(v.number(), v.integer()),
  body: v.pipe(v.string(), v.minLength(1)),
});

export function registerCommentsRoutes(app: FastifyInstance, context: { db: Db }) {
  const { db } = context;

  const createComment = async (request: FastifyRequest, reply: FastifyReply) => {
    const ticketId = parseId((request.params as { id: string }).id);
    const body = parseBody(createCommentSchema, request.body);
    const ticketRows = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    if (!ticketRows[0]) {
      throw new HttpError(404, 'ticket not found');
    }
    const created = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(comments)
        .values({ ticketId, authorId: body.authorId, body: body.body })
        .returning();
      const comment = inserted[0];
      if (!comment) {
        throw new HttpError(500, 'comment insert returned no row');
      }
      await writeEvent(tx, {
        ticketId,
        actorId: body.authorId,
        kind: 'commented',
        payload: { commentId: comment.id },
      });
      return comment;
    });
    reply.status(201).send(created);
  };

  app.post('/api/tickets/:id/comments', createComment);
}
