import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { commands } from '@tickets/db';
import { HttpError } from '../errors';
import { writeEvent } from '../event/write';
import type { CommandDef, CommandContext } from './registry';
import type { CommandEnvelope } from './envelope';

export async function runCommand<S extends v.GenericSchema, TResult>(
  db: Db,
  cmd: CommandDef<S, TResult>,
  envelope: CommandEnvelope,
  rawInput: unknown,
): Promise<TResult> {
  const input = v.parse(cmd.input, rawInput);
  const agg = cmd.aggregate(input);
  try {
    return await db.transaction(async (tx) => {
      // 1. ledger check — a replayed commandId returns the stored result verbatim
      const existing = await tx.select().from(commands).where(eq(commands.id, envelope.commandId));
      if (existing[0]) {
        return existing[0].result as TResult;
      }
      // 2. insert the ledger row (aggregateId 0 for creates; corrected at commit)
      await tx.insert(commands).values({
        id: envelope.commandId,
        aggregateType: agg.type,
        aggregateId: agg.id ?? 0,
        actorId: envelope.actorId,
      });
      // 3-4. run the handler; ctx.emit writes typed events + outbox
      const ctx: CommandContext = {
        envelope,
        aggregateId: agg.id ?? 0,
        projectId: null,
        emit: (def, payload) => writeEvent(tx, ctx, def, payload),
      };
      const result = await cmd.handler(tx, input, ctx);
      // 5. commit: store the result and the final aggregateId
      await tx
        .update(commands)
        .set({ result: result as unknown, aggregateId: ctx.aggregateId })
        .where(eq(commands.id, envelope.commandId));
      return result;
    });
  } catch (err) {
    // concurrent double-submit of the same commandId collides on the PK
    if (isCommandsPkeyCollision(err)) {
      throw new HttpError(409, 'command already in flight — retry');
    }
    throw err;
  }
}

// drizzle's postgres-js driver wraps every failed query in a DrizzleQueryError
// whose own `.message` is just "Failed query: ..." — the constraint name never
// appears there. The real node-postgres error (code, constraint_name) is
// preserved on `.cause`. Check both the caught error and its cause so this
// only matches a genuine PK collision on the commands ledger, never any other
// unique-violation a handler happens to trip (e.g. items_project_number,
// options_set_value, schemes_key_unique all raise the same 23505 code).
function isCommandsPkeyCollision(err: unknown): boolean {
  for (const e of [err, (err as { cause?: unknown } | undefined)?.cause]) {
    const pg = e as { code?: string; constraint_name?: string } | undefined;
    if (pg?.code === '23505' && pg?.constraint_name === 'commands_pkey') return true;
  }
  return false;
}
