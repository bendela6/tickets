import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { optionTransitions } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { transitionCreated, transitionDeleted } from './events';

export const transitionCreateInput = v.object({
  fieldId: v.pipe(v.number(), v.integer()),
  fromOptionId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  toOptionId: v.pipe(v.number(), v.integer()),
  itemTypeId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  config: v.optional(v.record(v.string(), v.unknown())),
});

export const transitionCreate = defineCommand({
  kind: 'transition.create',
  input: transitionCreateInput,
  aggregate: () => ({ type: 'transition' }),
  async handler(tx, input, ctx) {
    const inserted = await tx
      .insert(optionTransitions)
      .values({
        fieldId: input.fieldId,
        fromOptionId: input.fromOptionId ?? null,
        toOptionId: input.toOptionId,
        itemTypeId: input.itemTypeId ?? null,
        config: input.config ?? {},
      })
      .returning();
    const row = inserted[0]!;
    ctx.aggregateId = row.id;
    await ctx.emit(transitionCreated, {
      fieldId: row.fieldId, fromOptionId: row.fromOptionId, toOptionId: row.toOptionId, itemTypeId: row.itemTypeId,
    });
    return { id: row.id };
  },
});

export const transitionDeleteInput = v.object({ id: v.pipe(v.number(), v.integer()) });

export const transitionDelete = defineCommand({
  kind: 'transition.delete',
  input: transitionDeleteInput,
  aggregate: (input) => ({ type: 'transition', id: input.id }),
  async handler(tx, input, ctx) {
    const deleted = await tx.delete(optionTransitions).where(eq(optionTransitions.id, input.id)).returning();
    if (!deleted[0]) throw new HttpError(404, 'transition not found');
    await ctx.emit(transitionDeleted, {});
    return { id: input.id };
  },
});
