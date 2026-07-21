import { and, count, countDistinct, desc, eq, gte, ilike, inArray, max, min, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import * as v from 'valibot';
import type { Db } from '../db/client';
import { apps, issues, signals } from '../db/schema';
import { HttpError } from '../errors';

const PatchSchema = v.object({ status: v.picklist(['open', 'resolved', 'ignored']) });

const dayMs = 24 * 60 * 60 * 1000;

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new HttpError(400, 'invalid id');
  return id;
}

// level/mechanism of an issue's newest signal (same tiebreak rule as the list query);
// defaults if the issue somehow has no signals.
async function newestSignalInfo(db: Db, issueId: number): Promise<{ level: string; mechanism: string }> {
  const [row] = await db
    .select({ level: signals.level, mechanism: signals.mechanism })
    .from(signals)
    .where(eq(signals.issueId, issueId))
    .orderBy(desc(signals.receivedAt), desc(signals.id))
    .limit(1);
  return { level: row?.level ?? 'error', mechanism: row?.mechanism ?? 'manual' };
}

// UTC day-bucketed counts for the sparkline, oldest → newest, always `days` slots.
async function sparklines(db: Db, issueIds: number[], days: number): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>(issueIds.map((id) => [id, Array(days).fill(0)]));
  if (issueIds.length === 0) return result;
  const since = new Date(Date.now() - (days - 1) * dayMs);
  const rows = await db
    .select({
      issueId: signals.issueId,
      day: sql<string>`to_char(date_trunc('day', ${signals.receivedAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      n: count(),
    })
    .from(signals)
    .where(and(inArray(signals.issueId, issueIds), gte(signals.receivedAt, since)))
    .groupBy(signals.issueId, sql`2`);
  const today = new Date();
  for (const row of rows) {
    const slot = days - 1 - Math.floor(
      (Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - Date.parse(`${row.day}T00:00:00Z`)) / dayMs,
    );
    if (slot >= 0 && slot < days && row.issueId !== null) result.get(row.issueId)![slot] = row.n;
  }
  return result;
}

export function registerIssuesRoutes(app: FastifyInstance, context: { db: Db }) {
  app.get('/issues', async (request) => {
    const q = request.query as Record<string, string | undefined>;
    const days = Math.min(Number(q.days ?? 14) || 14, 90);
    const page = Math.max(Number(q.page ?? 1) || 1, 1);
    const perPage = Math.min(Number(q.perPage ?? 25) || 25, 100);

    const where = and(
      q.app ? eq(issues.appId, Number(q.app)) : undefined,
      q.status ? eq(issues.status, q.status as 'open' | 'resolved' | 'ignored') : undefined,
      gte(issues.lastSeen, new Date(Date.now() - days * dayMs)),
      q.q ? or(ilike(issues.title, `%${q.q}%`), ilike(issues.culprit, `%${q.q}%`)) : undefined,
    );

    const [totalRow] = await context.db.select({ total: count() }).from(issues).where(where);
    const total = totalRow?.total ?? 0;
    const rows = await context.db
      .select({
        id: issues.id, title: issues.title, culprit: issues.culprit, appId: issues.appId,
        appSlug: apps.slug, status: issues.status, eventCount: issues.eventCount,
        firstSeen: issues.firstSeen, lastSeen: issues.lastSeen,
      })
      .from(issues)
      .innerJoin(apps, eq(apps.id, issues.appId))
      .where(where)
      .orderBy(desc(issues.lastSeen))
      .limit(perPage)
      .offset((page - 1) * perPage);

    const ids = rows.map((r) => r.id);
    const sparks = await sparklines(context.db, ids, 14);
    // level/mechanism of the newest signal per issue
    const latest = ids.length
      ? await context.db
          .select({
            issueId: signals.issueId, level: signals.level, mechanism: signals.mechanism,
            rn: sql<number>`row_number() OVER (PARTITION BY ${signals.issueId} ORDER BY ${signals.receivedAt} DESC, ${signals.id} DESC)`,
          })
          .from(signals)
          .where(inArray(signals.issueId, ids))
      : [];
    const latestByIssue = new Map(latest.filter((l) => Number(l.rn) === 1).map((l) => [l.issueId, l]));

    // level filter applies to the newest signal's level; applied after pagination
    // since per-issue levels are only known post-query — acceptable for v1 (page sizes <=100).
    const enriched = rows
      .map((r) => ({
        ...r,
        key: `SGL-${r.id}`,
        level: latestByIssue.get(r.id)?.level ?? 'error',
        mechanism: latestByIssue.get(r.id)?.mechanism ?? 'manual',
        spark: sparks.get(r.id) ?? Array(14).fill(0),
      }))
      .filter((r) => (q.level ? r.level === q.level : true));

    return { rows: enriched, total };
  });

  app.get('/issues/:id', async (request) => {
    const id = parseId((request.params as { id: string }).id);
    const [row] = await context.db.select().from(issues).where(eq(issues.id, id));
    if (!row) throw new HttpError(404, 'issue not found');
    const [agg] = await context.db
      .select({
        sessionCount: countDistinct(signals.sessionId),
        userCount: countDistinct(sql`${signals.payload} -> 'user' ->> 'id'`),
        firstRelease: min(signals.release),
        lastRelease: max(signals.release),
      })
      .from(signals)
      .where(eq(signals.issueId, id));
    const spark = (await sparklines(context.db, [id], 14)).get(id)!;
    const [appRow] = await context.db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, row.appId));
    const { level, mechanism } = await newestSignalInfo(context.db, id);
    return {
      ...row,
      key: `SGL-${row.id}`,
      appSlug: appRow?.slug,
      level,
      mechanism,
      spark,
      sessionCount: agg!.sessionCount,
      userCount: agg!.userCount,
      releaseRange: { first: agg!.firstRelease, last: agg!.lastRelease },
    };
  });

  app.patch('/issues/:id', async (request) => {
    const id = parseId((request.params as { id: string }).id);
    const parsed = v.safeParse(PatchSchema, request.body ?? {});
    if (!parsed.success) throw new HttpError(400, 'status must be open, resolved, or ignored');
    const [row] = await context.db
      .update(issues).set({ status: parsed.output.status }).where(eq(issues.id, id)).returning();
    if (!row) throw new HttpError(404, 'issue not found');
    const [appRow] = await context.db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, row.appId));
    const { level, mechanism } = await newestSignalInfo(context.db, id);
    return { ...row, key: `SGL-${row.id}`, appSlug: appRow?.slug, level, mechanism };
  });

  app.get('/issues/:id/signals', async (request) => {
    const id = parseId((request.params as { id: string }).id);
    const q = request.query as Record<string, string | undefined>;
    const page = Math.max(Number(q.page ?? 1) || 1, 1);
    const perPage = Math.min(Number(q.perPage ?? 25) || 25, 100);
    const [totalRow] = await context.db
      .select({ total: count() }).from(signals).where(eq(signals.issueId, id));
    const total = totalRow?.total ?? 0;
    const rows = await context.db
      .select({
        id: signals.id, receivedAt: signals.receivedAt,
        release: signals.release, sessionId: signals.sessionId,
      })
      .from(signals)
      .where(eq(signals.issueId, id))
      .orderBy(desc(signals.receivedAt))
      .limit(perPage)
      .offset((page - 1) * perPage);
    return { rows, total };
  });
}
