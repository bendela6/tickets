import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { itemValues, items } from '@tickets/db';
import { defineAutomation } from '../registry';
import { loadSchemeVocab, type SchemeVocab } from '../../vocab/load-scheme-vocab';
import { itemUpdate } from '../../command/item/update';

const RESOLVED = new Set(['done', 'dropped']);

// The workflow option kind currently set on an item (null if unset).
async function statusKind(db: Db, vocab: SchemeVocab, itemId: number, wfId: number) {
  const rows = await db.select().from(itemValues).where(and(eq(itemValues.itemId, itemId), eq(itemValues.fieldId, wfId)));
  const optId = rows[0]?.optionId ?? null;
  return optId === null ? null : (vocab.optionById.get(optId)?.kind ?? null);
}

export const parentRollup = defineAutomation({
  id: 'parent-rollup',
  on: ['item.field_changed'],
  async when(event, tx) {
    const payload = event.payload as { fieldKey?: string; to?: unknown };
    const item = (await tx.select().from(items).where(eq(items.id, event.aggregateId)))[0];
    if (!item || item.parentId === null) return false;
    const vocab = await loadSchemeVocab(tx, { id: item.projectId });
    const wf = vocab.workflowField(item.typeId);
    if (!wf || payload.fieldKey !== wf.key) return false;
    // `when` is declared with tx: DbExecutor for future flexibility, but in current
    // usage it is always invoked with the root db handle (see run-automations.ts),
    // never a transaction — safe to narrow to Db here.
    const kind = await statusKind(tx as Db, vocab, item.id, wf.id);
    return kind !== null && RESOLVED.has(kind);
  },
  async run(event, ctx) {
    const db = ctx.db;
    const item = (await db.select().from(items).where(eq(items.id, event.aggregateId)))[0];
    if (!item || item.parentId === null) return;
    const vocab = await loadSchemeVocab(db, { id: item.projectId });
    const wf = vocab.workflowField(item.typeId)!;
    const parent = (await db.select().from(items).where(eq(items.id, item.parentId)))[0];
    if (!parent) return;
    const parentWf = vocab.workflowField(parent.typeId);
    if (!parentWf) return;
    const parentKind = await statusKind(db, vocab, parent.id, parentWf.id);
    if (parentKind !== null && RESOLVED.has(parentKind)) return;
    const siblings = await db.select().from(items).where(eq(items.parentId, parent.id));
    const sibIds = siblings.map((s) => s.id);
    const sibValues = sibIds.length
      ? await db.select().from(itemValues).where(and(inArray(itemValues.itemId, sibIds), eq(itemValues.fieldId, wf.id)))
      : [];
    const kindByItem = new Map<number, string | null>();
    for (const s of siblings) kindByItem.set(s.id, null);
    for (const v of sibValues) kindByItem.set(v.itemId, v.optionId === null ? null : (vocab.optionById.get(v.optionId)?.kind ?? null));
    const allResolved = siblings.length > 0 && [...kindByItem.values()].every((k) => k !== null && RESOLVED.has(k));
    if (!allResolved) return;
    const doneOption = vocab.optionsForField(parent.typeId, parentWf.id).find((o) => o.kind === 'done' && !o.archivedAt);
    if (!doneOption) return;
    await ctx.dispatch(itemUpdate, {
      id: parent.id, expectedUpdatedAt: parent.updatedAt, values: { [parentWf.key]: doneOption.value },
    }, 'parent');
  },
});
