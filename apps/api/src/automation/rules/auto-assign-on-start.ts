import { and, eq } from 'drizzle-orm';
import { itemValues, items } from '@tickets/db';
import { defineAutomation } from '../registry';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { itemUpdate } from '../../command/item/update';

export const autoAssignOnStart = defineAutomation({
  id: 'auto-assign-on-start',
  on: ['item.field_changed'],
  async when(event, tx) {
    const payload = event.payload as { fieldKey?: string };
    const item = (await tx.select().from(items).where(eq(items.id, event.aggregateId)))[0];
    if (!item) return false;
    const vocab = await loadSchemeVocab(tx, { id: item.projectId });
    const wf = vocab.workflowField(item.typeId);
    if (!wf || payload.fieldKey !== wf.key) return false;
    // new status is 'active'?
    const statusRows = await tx.select().from(itemValues).where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, wf.id)));
    const optId = statusRows[0]?.optionId ?? null;
    if (optId === null || vocab.optionById.get(optId)?.kind !== 'active') return false;
    // assignee empty?
    const assigneeField = vocab.fieldByTypeKey.get(`${item.typeId}:assignee`);
    if (!assigneeField) return false;
    const assigneeRows = await tx.select().from(itemValues).where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, assigneeField.id)));
    return assigneeRows.length === 0;
  },
  async run(event, ctx) {
    const db = ctx.db;
    const item = (await db.select().from(items).where(eq(items.id, event.aggregateId)))[0];
    if (!item) return;
    await ctx.dispatch(itemUpdate, {
      id: item.id, expectedUpdatedAt: item.updatedAt, values: { assignee: event.actorId },
    }, 'assign');
  },
});
