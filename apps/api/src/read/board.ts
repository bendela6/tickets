import { inArray } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { itemTypeChildTypes, itemTypeFields, options } from '@tickets/db';
import { loadSchemeVocab } from '../vocab/load-scheme-vocab';
import { assembleItems } from './assemble-items';

// New shape: no statuses[]/transitions[] arrays. Workflow columns and lifecycle
// rollups derive from options.kind + option_transitions.
export async function buildBoard(db: Db, key: string) {
  const vocab = await loadSchemeVocab(db, { key });
  const typeIds = vocab.types.map((t) => t.id);
  const [placements, allOptions, childTypes] = await Promise.all([
    typeIds.length ? db.select().from(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, typeIds)) : [],
    db.select().from(options).where(inArray(options.optionSetId, [...new Set([...vocab.fieldById.values()].map((f) => f.optionSetId).filter((x): x is number => x != null))])),
    typeIds.length ? db.select().from(itemTypeChildTypes).where(inArray(itemTypeChildTypes.parentTypeId, typeIds)) : [],
  ]);
  const items = await assembleItems(db, vocab);
  return {
    project: vocab.project,
    types: vocab.types,
    fields: [...vocab.fieldById.values()],
    placements,
    options: allOptions,
    transitions: vocab.transitions,
    linkTypes: [...vocab.linkTypeByTypeKey.values()],
    views: vocab.views,
    users: [...vocab.usersById.values()],
    childTypes,
    items,
  };
}

export type Board = Awaited<ReturnType<typeof buildBoard>>;
