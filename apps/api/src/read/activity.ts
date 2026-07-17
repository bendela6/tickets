import { asc, desc, eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { itemActivity } from '@tickets/db';

export interface ActivityEntry {
  id: number;
  itemId: number;
  eventId: number;
  kind: string;
  actorId: number;
  at: string;
  correlationId: string;
  summary: Record<string, unknown>;
}

function toEntry(row: typeof itemActivity.$inferSelect): ActivityEntry {
  return {
    id: row.id,
    itemId: row.itemId,
    eventId: row.eventId,
    kind: row.kind,
    actorId: row.actorId,
    at: row.at,
    correlationId: row.correlationId,
    summary: row.summary as Record<string, unknown>,
  };
}

export async function itemActivityFeed(db: Db, itemId: number): Promise<ActivityEntry[]> {
  const rows = await db
    .select()
    .from(itemActivity)
    .where(eq(itemActivity.itemId, itemId))
    .orderBy(asc(itemActivity.at), asc(itemActivity.id));
  return rows.map(toEntry);
}

export async function projectActivityFeed(db: Db, projectId: number, limit = 100): Promise<ActivityEntry[]> {
  const rows = await db
    .select()
    .from(itemActivity)
    .where(eq(itemActivity.projectId, projectId))
    .orderBy(desc(itemActivity.at), desc(itemActivity.id))
    .limit(limit);
  return rows.map(toEntry);
}
