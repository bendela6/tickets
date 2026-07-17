import * as v from 'valibot';
import { count, eq, sql } from 'drizzle-orm';
import { fields, options } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { optionCreated, optionUpdated } from './events';

const KINDS = ['todo', 'active', 'blocked', 'done', 'dropped'] as const;

// POST /api/fields/:id/options — add an option to the field's option set.
// A workflow status is exactly this: an option with a lifecycle `kind`.
export const optionCreateInput = v.object({
  fieldId: v.pipe(v.number(), v.integer()),
  value: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  kind: v.optional(v.nullable(v.picklist(KINDS))),
  config: v.optional(v.record(v.string(), v.unknown())),
});

export const optionCreate = defineCommand({
  kind: 'option.create',
  input: optionCreateInput,
  aggregate: () => ({ type: 'option' }),
  async handler(tx, input, ctx) {
    const fieldRows = await tx.select().from(fields).where(eq(fields.id, input.fieldId));
    const field = fieldRows[0];
    if (!field || field.optionSetId == null) throw new HttpError(400, 'field has no option set');
    const position = Number(
      (await tx.select({ n: count() }).from(options).where(eq(options.optionSetId, field.optionSetId)))[0]?.n ?? 0,
    );
    const inserted = await tx
      .insert(options)
      .values({
        optionSetId: field.optionSetId, value: input.value, label: input.label,
        position, kind: input.kind ?? null, config: input.config ?? {},
      })
      .returning();
    const option = inserted[0]!;
    ctx.aggregateId = option.id;
    await ctx.emit(optionCreated, {
      optionSetId: field.optionSetId, value: option.value, label: option.label, kind: option.kind,
    });
    return { id: option.id };
  },
});

export const optionUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  label: v.optional(v.string()),
  kind: v.optional(v.nullable(v.picklist(KINDS))),
  config: v.optional(v.record(v.string(), v.unknown())),
  archived: v.optional(v.boolean()),
});

export const optionUpdate = defineCommand({
  kind: 'option.update',
  input: optionUpdateInput,
  aggregate: (input) => ({ type: 'option', id: input.id }),
  async handler(tx, input, ctx) {
    const set: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};
    if (input.label !== undefined) { set.label = input.label; changes.label = input.label; }
    if (input.kind !== undefined) { set.kind = input.kind; changes.kind = input.kind; }
    if (input.config !== undefined) { set.config = input.config; changes.config = input.config; }
    if (input.archived !== undefined) {
      set.archivedAt = input.archived ? sql`now()` : null;
      changes.archived = input.archived;
    }
    if (Object.keys(set).length === 0) throw new HttpError(400, 'no option changes supplied');
    const updated = await tx.update(options).set(set).where(eq(options.id, input.id)).returning();
    if (!updated[0]) throw new HttpError(404, 'option not found');
    await ctx.emit(optionUpdated, { changes });
    return { id: input.id };
  },
});
