import { and, eq, sql } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { events } from '@tickets/db';

// max(seq)+1 for the stream, computed inside the caller's transaction. The
// unique(aggregate_type, aggregate_id, seq) index is the backstop if two txns race.
export async function nextSeq(
  tx: DbExecutor,
  aggregateType: string,
  aggregateId: number,
): Promise<number> {
  const rows = await tx
    .select({ max: sql<number>`coalesce(max(${events.seq}), 0)` })
    .from(events)
    .where(and(eq(events.aggregateType, aggregateType), eq(events.aggregateId, aggregateId)));
  return Number(rows[0]?.max ?? 0) + 1;
}
