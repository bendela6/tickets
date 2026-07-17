import * as v from 'valibot';
import type { DbExecutor } from '@tickets/db';
import { events, outbox } from '@tickets/db';
import { eventKind, type EventDef } from './registry';
import { nextSeq } from './seq';

// Inline shape matching `CommandEnvelope` (apps/api/src/command/envelope.ts).
// Structurally compatible — kept inline so this module has no cross-import.
export interface EmitContext {
  envelope: { commandId: string; actorId: number; correlationId?: string; causedBy?: number; depth?: number };
  aggregateId: number;
  projectId: number | null;
}

export async function writeEvent<S extends v.GenericSchema>(
  tx: DbExecutor,
  ctx: EmitContext,
  def: EventDef<S>,
  payload: v.InferOutput<S>,
): Promise<number> {
  if (eventKind(def.kind) !== (def as unknown as EventDef)) {
    throw new Error(`event kind "${def.kind}" is not registered — use defineEvent`);
  }
  const parsed = v.parse(def.payload, payload);
  const seq = await nextSeq(tx, def.aggregateType, ctx.aggregateId);
  const inserted = await tx
    .insert(events)
    .values({
      aggregateType: def.aggregateType,
      aggregateId: ctx.aggregateId,
      seq,
      kind: def.kind,
      version: def.version,
      payload: parsed as unknown,
      actorId: ctx.envelope.actorId,
      commandId: ctx.envelope.commandId,
      correlationId: ctx.envelope.correlationId ?? ctx.envelope.commandId,
      causedBy: ctx.envelope.causedBy ?? null,
      depth: ctx.envelope.depth ?? 0,
      projectId: ctx.projectId,
    })
    .returning({ id: events.id });
  const eventId = inserted[0]?.id;
  if (eventId === undefined) throw new Error('event insert returned no id');
  await tx.insert(outbox).values({ eventId });
  return eventId;
}
