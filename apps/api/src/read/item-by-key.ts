import { eq } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { items } from '@tickets/db';
import { HttpError } from '../errors';
import { loadSchemeVocab } from '../vocab/load-scheme-vocab';
import { assembleItems } from './assemble-items';

// One item by its key, unique across every project: the item as the board
// gives it, with its project's key and its type's.
export async function itemByKey(db: DbExecutor, key: string) {
  const row = (await db.select({ id: items.id, projectId: items.projectId }).from(items).where(eq(items.key, key)))[0];
  if (!row) throw new HttpError(404, `no item ${key}`);
  const vocab = await loadSchemeVocab(db, { id: row.projectId });
  const [item] = await assembleItems(db, vocab, [row.id]);
  if (!item) throw new HttpError(404, `no item ${key}`);
  return { ...item, projectKey: vocab.project.key, typeKey: vocab.typeById.get(item.typeId)?.key ?? null };
}
