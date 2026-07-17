import * as v from 'valibot';
import { and, asc, count, eq } from 'drizzle-orm';
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

    // Renumber the remaining placements on this type to a dense 0..n-1 run
    // (ordered by their current position), so a leftover gap can't collide
    // with a later count-based position from fieldPlace/fieldCreate. Without
    // this, unplacing a middle row leaves a gap (e.g. 0,1,3,4); the next
    // placement lands at count=4, colliding with the existing row at
    // position 4 — and since move() in the Fields tab swaps by *value*, the
    // tie can never be broken through the UI again.
    const remaining = await tx.select().from(itemTypeFields)
      .where(eq(itemTypeFields.itemTypeId, input.itemTypeId))
      .orderBy(asc(itemTypeFields.position));
    for (let i = 0; i < remaining.length; i++) {
      const row = remaining[i]!;
      if (row.position !== i) {
        await tx.update(itemTypeFields).set({ position: i })
          .where(and(eq(itemTypeFields.itemTypeId, input.itemTypeId), eq(itemTypeFields.fieldId, row.fieldId)));
      }
    }

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
      // Both optionsForField() implementations (web + api) do
      // `allow ? all.filter(...) : all` — and `[]` is truthy, so storing an
      // empty array filters to ZERO options while the Fields tab's "Clear"
      // control claims "all options allowed". Treat an empty array as
      // "clear the override" instead of "allow nothing", so it falls
      // through to the same "all options" behavior the UI advertises.
      const currentOverride = { ...((existing.configOverride as Record<string, unknown> | null) ?? {}) };
      if (input.allowedOptionIds.length === 0) {
        delete currentOverride.allowedOptionIds;
        set.configOverride = Object.keys(currentOverride).length > 0 ? currentOverride : null;
      } else {
        set.configOverride = { ...currentOverride, allowedOptionIds: input.allowedOptionIds };
      }
      changes.allowedOptionIds = input.allowedOptionIds;
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
