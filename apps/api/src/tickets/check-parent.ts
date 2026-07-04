import { eq } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { tickets } from '@tickets/db';
import { HttpError } from '../errors';

// Hierarchy policy: depth 1. A parent cannot itself have a parent, and a
// ticket that already has children cannot become a child.
export async function checkParent(
  db: DbExecutor,
  input: { ticketId: number | null; parentId: number; projectId: number },
): Promise<void> {
  const parentRows = await db.select().from(tickets).where(eq(tickets.id, input.parentId));
  const parent = parentRows[0];
  if (!parent || parent.projectId !== input.projectId) {
    throw new HttpError(400, 'parent ticket not found in this project');
  }
  if (parent.parentId !== null) {
    throw new HttpError(422, 'hierarchy is depth-1: the parent is itself a child');
  }
  if (input.ticketId !== null) {
    if (input.ticketId === input.parentId) {
      throw new HttpError(422, 'a ticket cannot be its own parent');
    }
    const childRows = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.parentId, input.ticketId));
    if (childRows.length > 0) {
      throw new HttpError(422, 'hierarchy is depth-1: this ticket already has children');
    }
  }
}
