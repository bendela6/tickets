import type { FastifyInstance } from 'fastify';
import { and, count, desc, eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { events, users } from '@tickets/db';
import { buildBoard } from '../read/board';
import { parseId } from '../utils/parse-id';

export function registerBoardRoutes(app: FastifyInstance, ctx: { db: Db }) {
  const { db } = ctx;

  app.get('/api/projects/:key/board', async (request, reply) => {
    const { key } = request.params as { key: string };
    reply.send(await buildBoard(db, key));
  });

  // item event history (reads the events log; imported version:0 rows show as history)
  app.get('/api/items/:id/events', async (request, reply) => {
    const id = parseId((request.params as { id: string }).id);
    const query = request.query as { skip?: string; take?: string };
    const skip = Math.max(0, Number(query.skip ?? 0) || 0);
    const take = Math.min(200, Math.max(1, Number(query.take ?? 50) || 50));
    const stream = and(eq(events.aggregateType, 'item'), eq(events.aggregateId, id));
    const [rows, total] = await Promise.all([
      db
        .select({
          id: events.id, seq: events.seq, kind: events.kind, payload: events.payload,
          actorId: events.actorId, actorName: users.name, at: events.at, version: events.version,
        })
        .from(events)
        .innerJoin(users, eq(users.id, events.actorId))
        .where(stream)
        .orderBy(desc(events.seq), desc(events.id))
        .offset(skip)
        .limit(take),
      db.select({ value: count() }).from(events).where(stream),
    ]);
    reply.send({ data: rows, meta: { skip, take, total: total[0]?.value ?? 0, sort: '-seq' } });
  });
}
