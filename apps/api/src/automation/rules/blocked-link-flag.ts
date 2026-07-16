import { and, eq } from 'drizzle-orm';
import { itemLinks, itemValues, items } from '@tickets/db';
import { defineAutomation } from '../registry';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { itemComment } from '../../command/item/comment';

const RESOLVED = new Set(['done', 'dropped']);

export const blockedLinkFlag = defineAutomation({
  id: 'blocked-link-flag',
  on: ['item.field_changed'],
  async when(event, tx) {
    const payload = event.payload as { fieldKey?: string; from?: unknown };
    const item = (await tx.select().from(items).where(eq(items.id, event.aggregateId)))[0];
    if (!item) return false;
    const vocab = await loadSchemeVocab(tx, { id: item.projectId });
    const wf = vocab.workflowField(item.typeId);
    if (!wf || payload.fieldKey !== wf.key) return false;
    // the previous value was resolved …
    const fromValue = typeof payload.from === 'string' ? payload.from : null;
    const fromOption = fromValue === null ? undefined : vocab.optionsForField(item.typeId, wf.id).find((o) => o.value === fromValue);
    if (!fromOption || !RESOLVED.has(fromOption.kind ?? '')) return false;
    // … and the new value is not resolved
    const nowRows = await tx.select().from(itemValues).where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, wf.id)));
    const nowOptId = nowRows[0]?.optionId ?? null;
    const nowKind = nowOptId === null ? null : (vocab.optionById.get(nowOptId)?.kind ?? null);
    return nowKind === null || !RESOLVED.has(nowKind);
  },
  async run(event, ctx) {
    const db = ctx.db;
    const item = (await db.select().from(items).where(eq(items.id, event.aggregateId)))[0];
    if (!item) return;
    const vocab = await loadSchemeVocab(db, { id: item.projectId });
    const blocks = vocab.linkTypeByTypeKey.get(`${item.typeId}:blocks`);
    if (!blocks) return;
    const links = await db.select().from(itemLinks)
      .where(and(eq(itemLinks.linkTypeId, blocks.id), eq(itemLinks.sourceItemId, item.id)));
    for (const link of links) {
      await ctx.dispatch(itemComment, {
        itemId: link.targetItemId,
        body: `Blocker #${item.number} was reopened`,
      }, String(link.targetItemId));
    }
  },
});
