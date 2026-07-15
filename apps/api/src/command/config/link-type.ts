import * as v from 'valibot';
import { count, eq } from 'drizzle-orm';
import { itemTypes, linkTypeTargetTypes, linkTypes } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { linkTypeCreated } from './events';

export const linkTypeCreateInput = v.object({
  itemTypeId: v.pipe(v.number(), v.integer()),
  key: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  inverseLabel: v.pipe(v.string(), v.minLength(1)),
  directional: v.boolean(),
  targetTypeIds: v.optional(v.array(v.pipe(v.number(), v.integer()))),
});

export const linkTypeCreate = defineCommand({
  kind: 'linkType.create',
  input: linkTypeCreateInput,
  aggregate: () => ({ type: 'link_type' }),
  async handler(tx, input, ctx) {
    const type = (await tx.select().from(itemTypes).where(eq(itemTypes.id, input.itemTypeId)))[0];
    if (!type) throw new HttpError(400, 'unknown item type');
    const position = Number(
      (await tx.select({ n: count() }).from(linkTypes).where(eq(linkTypes.itemTypeId, input.itemTypeId)))[0]?.n ?? 0,
    );
    const inserted = await tx
      .insert(linkTypes)
      .values({
        itemTypeId: input.itemTypeId, key: input.key, label: input.label,
        inverseLabel: input.inverseLabel, directional: input.directional, position,
      })
      .returning();
    const linkType = inserted[0]!;
    ctx.aggregateId = linkType.id;
    if (input.targetTypeIds?.length) {
      await tx.insert(linkTypeTargetTypes).values(
        input.targetTypeIds.map((targetTypeId) => ({ linkTypeId: linkType.id, targetTypeId })),
      );
    }
    await ctx.emit(linkTypeCreated, { itemTypeId: input.itemTypeId, key: linkType.key, label: linkType.label });
    return { id: linkType.id };
  },
});
