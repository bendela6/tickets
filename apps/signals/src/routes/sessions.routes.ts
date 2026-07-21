import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import { signals } from '../db/schema';
import { HttpError } from '../errors';

export function registerSessionsRoutes(app: FastifyInstance, context: { db: Db }) {
  app.get('/sessions/:sessionId/signals', async (request) => {
    const sessionId = (request.params as { sessionId: string }).sessionId;
    const q = request.query as { app?: string };
    const rows = await context.db
      .select()
      .from(signals)
      .where(and(
        eq(signals.sessionId, sessionId),
        q.app ? eq(signals.appId, Number(q.app)) : undefined,
      ))
      .orderBy(asc(signals.clientTimestamp), asc(signals.id));
    if (rows.length === 0) throw new HttpError(404, 'session not found');

    const startedAt = rows[0]!.clientTimestamp;
    const endedAt = rows[rows.length - 1]!.clientTimestamp;
    const counts = { error: 0, log: 0, event: 0 };
    for (const r of rows) counts[r.kind] += 1;

    return {
      session: {
        sessionId,
        appId: rows[0]!.appId,
        startedAt,
        endedAt,
        durationMs: endedAt.getTime() - startedAt.getTime(),
        crashed: counts.error > 0,
        counts,
        release: rows.find((r) => r.release)?.release ?? null,
        platform: rows[0]!.payload.platform,
      },
      rows: rows.map((r) => ({
        id: r.id, kind: r.kind, name: r.name, message: r.message,
        mechanism: r.mechanism, level: r.level, clientTimestamp: r.clientTimestamp,
        issueId: r.issueId, issueKey: r.issueId === null ? null : `SGL-${r.issueId}`,
        payload: r.payload,
      })),
    };
  });
}
