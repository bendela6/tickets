import { and, eq } from 'drizzle-orm';
import type { DbExecutor } from '@tickets/db';
import { itemValues, items } from '@tickets/db';
import { defineAutomation } from '../registry';
import { loadSchemeVocab, type SchemeVocab } from '../../vocab/load-scheme-vocab';
import { itemUpdate } from '../../command/item/update';

// Keeps a multi-option `repos` field in step with a json `where` field
// (`[{ repo, part }]`, the plan scheme's): `repos` holds the repos `where`
// names, so a list filters and groups by repo. `repos` is derived: after any
// write to either field it is set again from `where`. A repo with no option in
// `repos` is left out.

// The two fields on a type, when it has both in the shapes this rule reads.
function fieldPair(vocab: SchemeVocab, typeId: number) {
  const where = vocab.fieldByTypeKey.get(`${typeId}:where`);
  const repos = vocab.fieldByTypeKey.get(`${typeId}:repos`);
  if (!where || !repos || where.archivedAt || repos.archivedAt) return undefined;
  if (where.type !== 'json' || repos.type !== 'option') return undefined;
  if ((repos.config as { multiple?: boolean }).multiple !== true) return undefined;
  return { where, repos };
}

// The repos a `where` names, each once, in the order it names them.
export function reposOf(where: unknown): string[] {
  if (!Array.isArray(where)) return [];
  const repos: string[] = [];
  for (const entry of where) {
    const repo = (entry as { repo?: unknown } | null)?.repo;
    if (typeof repo === 'string' && !repos.includes(repo)) repos.push(repo);
  }
  return repos;
}

async function loadItem(db: DbExecutor, id: number) {
  return (await db.select().from(items).where(eq(items.id, id)))[0];
}

export const reposFromWhere = defineAutomation({
  id: 'repos-from-where',
  on: ['item.created', 'item.field_changed'],
  async when(event, tx) {
    if (event.kind === 'item.field_changed') {
      const fieldKey = (event.payload as { fieldKey?: unknown }).fieldKey;
      if (fieldKey !== 'where' && fieldKey !== 'repos') return false;
    }
    const item = await loadItem(tx, event.aggregateId);
    if (!item) return false;
    const vocab = await loadSchemeVocab(tx, { id: item.projectId });
    return fieldPair(vocab, item.typeId) !== undefined;
  },
  async run(event, ctx) {
    const db = ctx.db;
    const item = await loadItem(db, event.aggregateId);
    if (!item) return;
    const vocab = await loadSchemeVocab(db, { id: item.projectId });
    const pair = fieldPair(vocab, item.typeId);
    if (!pair) return;

    const valuesOf = (fieldId: number) =>
      db.select().from(itemValues).where(and(eq(itemValues.itemId, item.id), eq(itemValues.fieldId, fieldId)));
    const whereRows = await valuesOf(pair.where.id);
    const offered = new Set(
      vocab.optionsForField(item.typeId, pair.repos.id).filter((o) => !o.archivedAt).map((o) => o.value),
    );
    const wanted = reposOf(whereRows[0]?.valueJson).filter((repo) => offered.has(repo));

    const held = (await valuesOf(pair.repos.id))
      .map((row) => (row.optionId === null ? undefined : vocab.optionById.get(row.optionId)?.value))
      .filter((value): value is string => value !== undefined);
    const same = held.length === wanted.length && wanted.every((repo) => held.includes(repo));
    if (same) return;

    await ctx.dispatch(itemUpdate, {
      id: item.id, expectedUpdatedAt: item.updatedAt, values: { [pair.repos.key]: wanted },
    }, 'repos');
  },
});
