import { eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { ticketLinks } from '@tickets/db';
import { HttpError } from '../errors';

// Directional link types reject edges that would close a cycle: adding
// source→target is illegal if target already reaches source.
export async function checkLinkCycle(
  db: Db,
  input: { linkTypeId: number; sourceTicketId: number; targetTicketId: number },
): Promise<void> {
  const edges = await db
    .select({ source: ticketLinks.sourceTicketId, target: ticketLinks.targetTicketId })
    .from(ticketLinks)
    .where(eq(ticketLinks.linkTypeId, input.linkTypeId));
  const bySource = new Map<number, number[]>();
  for (const edge of edges) {
    const bucket = bySource.get(edge.source) ?? [];
    bucket.push(edge.target);
    bySource.set(edge.source, bucket);
  }
  const queue = [input.targetTicketId];
  const seen = new Set<number>(queue);
  while (queue.length > 0) {
    const current = queue.shift() as number;
    if (current === input.sourceTicketId) {
      throw new HttpError(422, 'this link would create a cycle');
    }
    for (const next of bySource.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
}
