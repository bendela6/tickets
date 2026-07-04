import type { DbExecutor } from '@tickets/db';
import { ticketEvents } from '@tickets/db';

export async function writeEvent(
  tx: DbExecutor,
  input: { ticketId: number; actorId: number; kind: string; payload?: unknown },
): Promise<void> {
  await tx.insert(ticketEvents).values({
    ticketId: input.ticketId,
    actorId: input.actorId,
    kind: input.kind,
    payload: input.payload ?? {},
  });
}
