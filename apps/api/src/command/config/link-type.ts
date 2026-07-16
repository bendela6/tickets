import * as v from 'valibot';
import { count, eq, sql } from 'drizzle-orm';
import { itemTypes, linkTypeTargetTypes, linkTypes } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { linkTypeCreated, linkTypeTargetTypesSet, linkTypeUpdated } from './events';

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

export const linkTypeUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  label: v.optional(v.pipe(v.string(), v.minLength(1))),
  inverseLabel: v.optional(v.pipe(v.string(), v.minLength(1))),
  directional: v.optional(v.boolean()),
  archived: v.optional(v.boolean()),
});

export const linkTypeUpdate = defineCommand({
  kind: 'linkType.update',
  input: linkTypeUpdateInput,
  aggregate: (input) => ({ type: 'link_type', id: input.id }),
  async handler(tx, input, ctx) {
    if (!(await tx.select().from(linkTypes).where(eq(linkTypes.id, input.id)))[0]) throw new HttpError(404, 'link type not found');
    const changes: Record<string, unknown> = {};
    const set: Record<string, unknown> = {};
    if (input.label !== undefined) { set.label = input.label; changes.label = input.label; }
    if (input.inverseLabel !== undefined) { set.inverseLabel = input.inverseLabel; changes.inverseLabel = input.inverseLabel; }
    if (input.directional !== undefined) { set.directional = input.directional; changes.directional = input.directional; }
    if (input.archived !== undefined) { set.archivedAt = input.archived ? sql`now()` : null; changes.archived = input.archived; }
    if (Object.keys(set).length > 0) await tx.update(linkTypes).set(set).where(eq(linkTypes.id, input.id));
    ctx.aggregateId = input.id;
    await ctx.emit(linkTypeUpdated, { changes });
    return { id: input.id };
  },
});

export const linkTypeSetTargetTypesInput = v.object({
  linkTypeId: v.pipe(v.number(), v.integer()),
  targetTypeIds: v.array(v.pipe(v.number(), v.integer())),
});

export const linkTypeSetTargetTypes = defineCommand({
  kind: 'linkType.setTargetTypes',
  input: linkTypeSetTargetTypesInput,
  aggregate: (input) => ({ type: 'link_type', id: input.linkTypeId }),
  async handler(tx, input, ctx) {
    if (!(await tx.select().from(linkTypes).where(eq(linkTypes.id, input.linkTypeId)))[0]) throw new HttpError(404, 'link type not found');
    await tx.delete(linkTypeTargetTypes).where(eq(linkTypeTargetTypes.linkTypeId, input.linkTypeId));
    if (input.targetTypeIds.length > 0) {
      await tx.insert(linkTypeTargetTypes).values(input.targetTypeIds.map((targetTypeId) => ({ linkTypeId: input.linkTypeId, targetTypeId })));
    }
    ctx.aggregateId = input.linkTypeId;
    await ctx.emit(linkTypeTargetTypesSet, { targetTypeIds: input.targetTypeIds });
    return { linkTypeId: input.linkTypeId };
  },
});
