import { eq, inArray, or } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { comments, itemLinks, itemValues, items } from '@tickets/db';
import { renderValue } from '../values/render-value';
import type { SchemeVocab } from '../vocab/load-scheme-vocab';

export async function assembleItems(db: DbExecutor, vocab: SchemeVocab) {
  const itemRows = await db.select().from(items).where(eq(items.projectId, vocab.project.id));
  if (itemRows.length === 0) return [];
  const ids = itemRows.map((r) => r.id);

  const [valueRows, commentRows, linkRows] = await Promise.all([
    db.select().from(itemValues).where(inArray(itemValues.itemId, ids)),
    db.select().from(comments).where(inArray(comments.itemId, ids)),
    db.select().from(itemLinks).where(or(inArray(itemLinks.sourceItemId, ids), inArray(itemLinks.targetItemId, ids))),
  ]);

  const valuesByItem = new Map<number, Record<string, unknown>>();
  for (const row of valueRows) {
    const field = vocab.fieldById.get(row.fieldId);
    if (!field) continue;
    const bucket = valuesByItem.get(row.itemId) ?? {};
    const rendered = renderValue(vocab, row);
    const multiple = (field.config as { multiple?: boolean }).multiple === true;
    if (multiple) {
      const existing = (bucket[field.key] as unknown[] | undefined) ?? [];
      existing.push(rendered);
      bucket[field.key] = existing;
    } else {
      bucket[field.key] = rendered;
    }
    valuesByItem.set(row.itemId, bucket);
  }

  const commentsByItem = new Map<number, typeof commentRows>();
  for (const row of commentRows) {
    const bucket = commentsByItem.get(row.itemId) ?? [];
    bucket.push(row);
    commentsByItem.set(row.itemId, bucket);
  }
  const linksByItem = new Map<number, typeof linkRows>();
  for (const row of linkRows) {
    for (const itemId of [row.sourceItemId, row.targetItemId]) {
      const bucket = linksByItem.get(itemId) ?? [];
      if (!bucket.includes(row)) bucket.push(row);
      linksByItem.set(itemId, bucket);
    }
  }

  return itemRows.map((row) => ({
    id: row.id,
    number: row.number,
    typeId: row.typeId,
    parentId: row.parentId,
    createdBy: row.createdBy,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    values: valuesByItem.get(row.id) ?? {},
    comments: commentsByItem.get(row.id) ?? [],
    links: linksByItem.get(row.id) ?? [],
  }));
}

export type AssembledItem = Awaited<ReturnType<typeof assembleItems>>[number];
