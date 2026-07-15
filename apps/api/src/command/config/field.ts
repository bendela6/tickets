import * as v from 'valibot';
import { count, eq, sql } from 'drizzle-orm';
import { fields, itemTypeFields, itemTypes } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { fieldCreated, fieldPlaced, fieldUpdated } from './events';

const FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'datetime', 'option', 'user', 'json'] as const;

export const fieldCreateInput = v.object({
  itemTypeId: v.pipe(v.number(), v.integer()),
  key: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  type: v.picklist(FIELD_TYPES),
  required: v.optional(v.boolean()),
  config: v.optional(v.record(v.string(), v.unknown())),
  optionSetId: v.optional(v.pipe(v.number(), v.integer())),
});

export const fieldCreate = defineCommand({
  kind: 'field.create',
  input: fieldCreateInput,
  aggregate: () => ({ type: 'field' }),
  async handler(tx, input, ctx) {
    const typeRows = await tx.select().from(itemTypes).where(eq(itemTypes.id, input.itemTypeId));
    const type = typeRows[0];
    if (!type) throw new HttpError(400, 'unknown item type');
    if (input.type === 'option' && input.optionSetId === undefined) {
      throw new HttpError(400, 'an option field needs an optionSetId');
    }
    // create the scheme-library field
    const inserted = await tx
      .insert(fields)
      .values({
        schemeId: type.schemeId,
        key: input.key,
        label: input.label,
        type: input.type,
        config: input.config ?? {},
        optionSetId: input.optionSetId ?? null,
      })
      .returning();
    const field = inserted[0]!;
    ctx.aggregateId = field.id;
    await ctx.emit(fieldCreated, { schemeId: type.schemeId, key: field.key, label: field.label, type: field.type });
    // place it on the type at the next position
    const position = (await tx.select({ n: count() }).from(itemTypeFields).where(eq(itemTypeFields.itemTypeId, type.id)))[0]?.n ?? 0;
    await tx.insert(itemTypeFields).values({
      itemTypeId: type.id, fieldId: field.id, position: Number(position), required: input.required ?? false,
    });
    await ctx.emit(fieldPlaced, { itemTypeId: type.id, position: Number(position), required: input.required ?? false });
    return { id: field.id };
  },
});

export const fieldUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  label: v.optional(v.string()),
  config: v.optional(v.record(v.string(), v.unknown())),
  archived: v.optional(v.boolean()),
});

export const fieldUpdate = defineCommand({
  kind: 'field.update',
  input: fieldUpdateInput,
  aggregate: (input) => ({ type: 'field', id: input.id }),
  async handler(tx, input, ctx) {
    const changes: Record<string, unknown> = {};
    const set: Record<string, unknown> = {};
    if (input.label !== undefined) { set.label = input.label; changes.label = input.label; }
    if (input.config !== undefined) { set.config = input.config; changes.config = input.config; }
    if (input.archived !== undefined) {
      set.archivedAt = input.archived ? sql`now()` : null;
      changes.archived = input.archived;
    }
    if (Object.keys(set).length === 0) throw new HttpError(400, 'no field changes supplied');
    const updated = await tx.update(fields).set(set).where(eq(fields.id, input.id)).returning();
    if (!updated[0]) throw new HttpError(404, 'field not found');
    await ctx.emit(fieldUpdated, { changes });
    return { id: input.id };
  },
});
