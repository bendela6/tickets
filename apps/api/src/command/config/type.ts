import * as v from 'valibot';
import { count, eq, sql } from 'drizzle-orm';
import { itemTypes } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { typeCreated, typeUpdated } from './events';

export const typeCreateInput = v.object({
  schemeId: v.pipe(v.number(), v.integer()),
  key: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  config: v.optional(v.record(v.string(), v.unknown())),
});

export const typeCreate = defineCommand({
  kind: 'type.create',
  input: typeCreateInput,
  aggregate: () => ({ type: 'type' }),
  async handler(tx, input, ctx) {
    const position = Number(
      (await tx.select({ n: count() }).from(itemTypes).where(eq(itemTypes.schemeId, input.schemeId)))[0]?.n ?? 0,
    );
    const inserted = await tx
      .insert(itemTypes)
      .values({ schemeId: input.schemeId, key: input.key, label: input.label, position, config: input.config ?? {} })
      .returning();
    const row = inserted[0]!;
    ctx.aggregateId = row.id;
    await ctx.emit(typeCreated, { schemeId: row.schemeId, key: row.key, label: row.label });
    return { id: row.id };
  },
});

export const typeUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  label: v.optional(v.pipe(v.string(), v.minLength(1))),
  config: v.optional(v.record(v.string(), v.unknown())),
  archived: v.optional(v.boolean()),
});

export const typeUpdate = defineCommand({
  kind: 'type.update',
  input: typeUpdateInput,
  aggregate: (input) => ({ type: 'type', id: input.id }),
  async handler(tx, input, ctx) {
    const existing = (await tx.select().from(itemTypes).where(eq(itemTypes.id, input.id)))[0];
    if (!existing) throw new HttpError(404, 'type not found');
    const changes: Record<string, unknown> = {};
    const set: Record<string, unknown> = {};
    if (input.label !== undefined) { set.label = input.label; changes.label = input.label; }
    if (input.config !== undefined) { set.config = input.config; changes.config = input.config; }
    if (input.archived !== undefined) { set.archivedAt = input.archived ? sql`now()` : null; changes.archived = input.archived; }
    if (Object.keys(set).length > 0) await tx.update(itemTypes).set(set).where(eq(itemTypes.id, input.id));
    ctx.aggregateId = input.id;
    await ctx.emit(typeUpdated, { changes });
    return { id: input.id };
  },
});
