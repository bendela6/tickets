import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { items } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { agentDispatched } from './events';

export const itemAgentDispatchedInput = v.object({
  itemId: v.pipe(v.number(), v.integer()),
  sessionId: v.pipe(v.number(), v.integer()),
  agentId: v.pipe(v.number(), v.integer()),
});

export const itemAgentDispatched = defineCommand({
  kind: 'item.agentDispatched',
  input: itemAgentDispatchedInput,
  aggregate: (input) => ({ type: 'item', id: input.itemId }),
  async handler(tx, input, ctx) {
    const rows = await tx.select().from(items).where(eq(items.id, input.itemId));
    const item = rows[0];
    if (!item) throw new HttpError(404, 'item not found');
    ctx.projectId = item.projectId;
    await ctx.emit(agentDispatched, { sessionId: input.sessionId, agentId: input.agentId });
    return { ok: true };
  },
});
