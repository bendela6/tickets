import * as v from 'valibot';
import { eq } from 'drizzle-orm';
import { itemLinks, items } from '@tickets/db';
import { HttpError } from '../../errors';
import { defineCommand } from '../registry';
import { loadSchemeVocab } from '../../vocab/load-scheme-vocab';
import { itemLinked, itemUnlinked } from './events';

export const itemLinkInput = v.object({
  sourceItemId: v.pipe(v.number(), v.integer()),
  targetItemId: v.pipe(v.number(), v.integer()),
  linkTypeKey: v.pipe(v.string(), v.minLength(1)),
});

export const itemLink = defineCommand({
  kind: 'item.link',
  input: itemLinkInput,
  aggregate: (input) => ({ type: 'item', id: input.sourceItemId }),
  async handler(tx, input, ctx) {
    if (input.sourceItemId === input.targetItemId) throw new HttpError(422, 'an item cannot link to itself');
    const rows = await tx.select().from(items).where(eq(items.id, input.sourceItemId));
    const source = rows[0];
    if (!source) throw new HttpError(404, 'source item not found');
    ctx.projectId = source.projectId;
    const vocab = await loadSchemeVocab(tx, { id: source.projectId });
    const linkType = vocab.linkTypeByTypeKey.get(`${source.typeId}:${input.linkTypeKey}`);
    if (!linkType) throw new HttpError(400, `unknown link type "${input.linkTypeKey}" for this item type`);
    const targetRows = await tx.select().from(items).where(eq(items.id, input.targetItemId));
    const target = targetRows[0];
    if (!target) throw new HttpError(404, 'target item not found');
    const allowedTargets = vocab.linkTypeTargets.get(linkType.id);
    if (allowedTargets && !allowedTargets.has(target.typeId)) {
      throw new HttpError(422, `"${input.linkTypeKey}" cannot target this item type`);
    }
    const inserted = await tx
      .insert(itemLinks)
      .values({ linkTypeId: linkType.id, sourceItemId: input.sourceItemId, targetItemId: input.targetItemId })
      .returning();
    await ctx.emit(itemLinked, { linkTypeKey: input.linkTypeKey, targetItemId: input.targetItemId });
    return { id: inserted[0]!.id };
  },
});

export const itemUnlinkInput = v.object({ id: v.pipe(v.number(), v.integer()) });

export const itemUnlink = defineCommand({
  kind: 'item.unlink',
  input: itemUnlinkInput,
  aggregate: () => ({ type: 'item' }),
  async handler(tx, input, ctx) {
    const rows = await tx.select().from(itemLinks).where(eq(itemLinks.id, input.id));
    const link = rows[0];
    if (!link) throw new HttpError(404, 'link not found');
    const source = (await tx.select().from(items).where(eq(items.id, link.sourceItemId)))[0]!;
    const vocab = await loadSchemeVocab(tx, { id: source.projectId });
    const linkTypeKey = [...vocab.linkTypeByTypeKey.entries()].find(([, lt]) => lt.id === link.linkTypeId)?.[1].key ?? '';
    ctx.aggregateId = link.sourceItemId;
    ctx.projectId = source.projectId;
    await tx.delete(itemLinks).where(eq(itemLinks.id, input.id));
    await ctx.emit(itemUnlinked, { linkTypeKey, targetItemId: link.targetItemId });
    return { id: input.id };
  },
});
