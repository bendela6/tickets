import { sql } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { tickets } from '@tickets/db';

// max+1 per project, serialized by locking the project row so concurrent
// creations can't collide on a number.
export async function nextTicketNumber(tx: DbExecutor, projectId: number): Promise<number> {
  await tx.execute(sql`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`);
  const rows = await tx
    .select({ max: sql<number>`coalesce(max(${tickets.number}), 0)` })
    .from(tickets)
    .where(sql`${tickets.projectId} = ${projectId}`);
  return Number(rows[0]?.max ?? 0) + 1;
}
