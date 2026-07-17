import * as v from 'valibot';
import { and, eq, sql } from 'drizzle-orm';
import { itemValues, items } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { buildValueRows } from '../../values/build-value-rows';
import { renderValue } from '../../values/render-value';
import { itemArchived, itemFieldChanged, itemReparented, itemRestored } from './events';
import { checkParent, checkTransition, lockItem, runTransitionGuard, transitionEdge } from './helpers';

export const itemUpdateInput = v.object({
  id: v.pipe(v.number(), v.integer()),
  expectedUpdatedAt: v.pipe(v.string(), v.minLength(1)),
  parentId: v.optional(v.nullable(v.pipe(v.number(), v.integer()))),
  archived: v.optional(v.boolean()),
  values: v.optional(v.record(v.string(), v.unknown())),
});

export const itemUpdate = defineCommand({
  kind: 'item.update',
  input: itemUpdateInput,
  aggregate: (input) => ({ type: 'item', id: input.id }),
  async handler(tx, input, ctx) {
    const item = await lockItem(tx, input.id, input.expectedUpdatedAt);
    const vocab = await loadSchemeVocab(tx, { id: item.projectId });
    const typeId = item.typeId; // type is immutable
    ctx.projectId = item.projectId;

    if (input.parentId !== undefined && input.parentId !== item.parentId) {
      if (input.parentId !== null) {
        await checkParent(tx, vocab, { itemId: item.id, parentId: input.parentId, childTypeId: typeId });
      }
      await tx.update(items).set({ parentId: input.parentId }).where(eq(items.id, item.id));
      await ctx.emit(itemReparented, { from: item.parentId, to: input.parentId });
    }

    if (input.archived !== undefined) {
      await tx.update(items).set({ archivedAt: input.archived ? sql`now()` : null }).where(eq(items.id, item.id));
      await ctx.emit(input.archived ? itemArchived : itemRestored, {});
    }

    const wf = vocab.workflowField(typeId);
    for (const [fieldKey, value] of Object.entries(input.values ?? {})) {
      const field = vocab.fieldByTypeKey.get(`${typeId}:${fieldKey}`);
      if (!field || field.archivedAt) throw new HttpError(400, `unknown field "${fieldKey}" for this item type`);

      const currentRows = await tx
        .select()
        .from(itemValues)
        .where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, field.id)));
      const from = currentRows.length === 0 ? null
        : currentRows.length === 1 ? renderValue(vocab, currentRows[0]!)
        : currentRows.map((r) => renderValue(vocab, r));

      const nextRows = buildValueRows(vocab, typeId, fieldKey, value);

      // no-op: same value set — skip write + emit entirely
      const sig = (rows: { optionId?: number | null; valueUserId?: number | null; valueText?: string | null; valueNumber?: string | null; valueDate?: string | null; valueBool?: boolean | null; valueJson?: unknown }[]) =>
        JSON.stringify(rows.map((r) => [r.optionId ?? null, r.valueUserId ?? null, r.valueText ?? null, r.valueNumber ?? null, r.valueDate ?? null, r.valueBool ?? null, r.valueJson ?? null]).sort());
      if (sig(currentRows) === sig(nextRows)) continue;

      // workflow field: transition legality + guard
      if (wf && field.id === wf.id) {
        const toOptionId = nextRows[0]?.optionId;
        if (!toOptionId) throw new HttpError(400, 'status cannot be cleared');
        const fromOptionId = currentRows[0]?.optionId ?? null;
        if (fromOptionId !== toOptionId) {
          checkTransition(vocab, { fieldId: field.id, typeId, fromOptionId, toOptionId });
          const edge = transitionEdge(vocab, { fieldId: field.id, typeId, fromOptionId, toOptionId });
          await runTransitionGuard(tx, vocab, { itemId: item.id, typeId, edge });
        }
      }

      // replace semantics
      await tx.delete(itemValues).where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, field.id)));
      if (nextRows.length > 0) {
        await tx.insert(itemValues).values(nextRows.map((r) => ({ ...r, itemId: item.id })));
      }
      await ctx.emit(itemFieldChanged, { fieldKey, from, to: value ?? null });
    }

    const finalRows = await tx.select().from(items).where(eq(items.id, item.id));
    return { id: item.id, updatedAt: finalRows[0]?.updatedAt };
  },
});
