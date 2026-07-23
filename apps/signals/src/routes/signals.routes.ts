import { and, count, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import { apps, signals } from '../db/schema';
import { parseIntParam as parseId } from '../params';

const dayMs = 24 * 60 * 60 * 1000;

// This endpoint is non-error only — errors live under /issues (grouped).
const LISTABLE_KINDS = ['log', 'event'] as const;
type ListableKind = (typeof LISTABLE_KINDS)[number];

function parseKinds(raw: string | undefined): ListableKind[] {
  const requested = (raw ?? 'log,event').split(',').map((k) => k.trim());
  return requested.filter((k): k is ListableKind => (LISTABLE_KINDS as readonly string[]).includes(k));
}

export function registerSignalsRoutes(app: FastifyInstance, context: { db: Db }) {
  app.get('/signals', async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const page = Math.max(Number(q.page ?? 1) || 1, 1);
    const perPage = Math.min(Number(q.perPage ?? 50) || 50, 100);
    const kinds = parseKinds(q.kind);

    const where = and(
      // no valid kind requested (e.g. `?kind=error`) → no rows, never "all kinds"
      kinds.length ? inArray(signals.kind, kinds) : sql`false`,
      q.app ? eq(signals.appId, parseId(q.app, 'app')) : undefined,
      q.level ? eq(signals.level, q.level as 'error' | 'warning' | 'info') : undefined,
      q.days ? gte(signals.receivedAt, new Date(Date.now() - Number(q.days) * dayMs)) : undefined,
      q.q ? or(ilike(signals.name, `%${q.q}%`), ilike(signals.message, `%${q.q}%`)) : undefined,
    );

    const [totalRow] = await context.db.select({ total: count() }).from(signals).where(where);
    const total = totalRow?.total ?? 0;

    const rows = await context.db
      .select({
        id: signals.id, appId: signals.appId, appSlug: apps.slug, kind: signals.kind,
        name: signals.name, message: signals.message, level: signals.level,
        mechanism: signals.mechanism, sessionId: signals.sessionId,
        clientTimestamp: signals.clientTimestamp, receivedAt: signals.receivedAt,
      })
      .from(signals)
      .innerJoin(apps, eq(apps.id, signals.appId))
      .where(where)
      .orderBy(desc(signals.receivedAt))
      .limit(perPage)
      .offset((page - 1) * perPage);

    return { rows, total };
  });
}
