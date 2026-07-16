import * as v from 'valibot';
import { and, count, eq } from 'drizzle-orm';
import { fields, itemTypeFields, itemTypes } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { fieldPlaced, fieldUnplaced, placementUpdated } from './events';

export const fieldPlaceInput = v.object({
  itemTypeId: v.pipe(v.number(), v.integer()),
  fieldId: v.pipe(v.number(), v.integer()),
  position: v.optional(v.pipe(v.number(), v.integer())),
  required: v.optional(v.boolean()),
  configOverride: v.optional(v.nullable(v.record(v.string(), v.unknown()))),
});

export const fieldPlace = defineCommand({
  kind: 'field.place',
  input: fieldPlaceInput,
  aggregate: (input) => ({ type: 'field', id: input.fieldId }),
  async handler(tx, input, ctx) {
    if (!(await tx.select().from(itemTypes).where(eq(itemTypes.id, input.itemTypeId)))[0]) throw new HttpError(400, 'unknown item type');
    if (!(await tx.select().from(fields).where(eq(fields.id, input.fieldId)))[0]) throw new HttpError(400, 'unknown field');
    const existing = await tx.select().from(itemTypeFields)
      .where(and(eq(itemTypeFields.itemTypeId, input.itemTypeId), eq(itemTypeFields.fieldId, input.fieldId)));
    if (existing[0]) throw new HttpError(422, 'field already placed on this type');
    const position = input.position ?? Number(
      (await tx.select({ n: count() }).from(itemTypeFields).where(eq(itemTypeFields.itemTypeId, input.itemTypeId)))[0]?.n ?? 0,
    );
    await tx.insert(itemTypeFields).values({
      itemTypeId: input.itemTypeId, fieldId: input.fieldId, position,
      required: input.required ?? false, configOverride: input.configOverride ?? null,
    });
    ctx.aggregateId = input.fieldId;
    await ctx.emit(fieldPlaced, { itemTypeId: input.itemTypeId, position, required: input.required ?? false });
    return { itemTypeId: input.itemTypeId, fieldId: input.fieldId };
  },
});

export const fieldUnplaceInput = v.object({
  itemTypeId: v.pipe(v.number(), v.integer()),
  fieldId: v.pipe(v.number(), v.integer()),
});

export const fieldUnplace = defineCommand({
  kind: 'field.unplace',
  input: fieldUnplaceInput,
  aggregate: (input) => ({ type: 'field', id: input.fieldId }),
  async handler(tx, input, ctx) {
    const deleted = await tx.delete(itemTypeFields)
      .where(and(eq(itemTypeFields.itemTypeId, input.itemTypeId), eq(itemTypeFields.fieldId, input.fieldId)))
      .returning();
    if (!deleted[0]) throw new HttpError(404, 'placement not found');
    ctx.aggregateId = input.fieldId;
    await ctx.emit(fieldUnplaced, { itemTypeId: input.itemTypeId });
    return { itemTypeId: input.itemTypeId, fieldId: input.fieldId };
  },
});

export const placementUpdateInput = v.object({
  itemTypeId: v.pipe(v.number(), v.integer()),
  fieldId: v.pipe(v.number(), v.integer()),
  required: v.optional(v.boolean()),
  position: v.optional(v.pipe(v.number(), v.integer())),
  allowedOptionIds: v.optional(v.array(v.pipe(v.number(), v.integer()))),
});

export const placementUpdate = defineCommand({
  kind: 'placement.update',
  input: placementUpdateInput,
  aggregate: (input) => ({ type: 'field', id: input.fieldId }),
  async handler(tx, input, ctx) {
    const existing = (await tx.select().from(itemTypeFields)
      .where(and(eq(itemTypeFields.itemTypeId, input.itemTypeId), eq(itemTypeFields.fieldId, input.fieldId))))[0];
    if (!existing) throw new HttpError(404, 'placement not found');
    const changes: Record<string, unknown> = {};
    const set: Record<string, unknown> = {};
    if (input.required !== undefined) { set.required = input.required; changes.required = input.required; }
    if (input.position !== undefined) { set.position = input.position; changes.position = input.position; }
    if (input.allowedOptionIds !== undefined) {
      const co = { ...((existing.configOverride as Record<string, unknown> | null) ?? {}), allowedOptionIds: input.allowedOptionIds };
      set.configOverride = co; changes.allowedOptionIds = input.allowedOptionIds;
    }
    if (Object.keys(set).length > 0) {
      await tx.update(itemTypeFields).set(set)
        .where(and(eq(itemTypeFields.itemTypeId, input.itemTypeId), eq(itemTypeFields.fieldId, input.fieldId)));
    }
    ctx.aggregateId = input.fieldId;
    await ctx.emit(placementUpdated, { itemTypeId: input.itemTypeId, changes });
    return { itemTypeId: input.itemTypeId, fieldId: input.fieldId };
  },
});
