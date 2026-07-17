import { inArray } from 'drizzle-orm';
import type { Db } from '@tickets/db';
import { itemTypeChildTypes, itemTypeFields, linkTypeTargetTypes, options } from '@tickets/db';
import { loadSchemeVocab } from '../vocab/load-scheme-vocab';
import { assembleItems } from './assemble-items';

// New shape: no statuses[]/transitions[] arrays. Workflow columns and lifecycle
// rollups derive from options.kind + option_transitions.
export async function buildBoard(db: Db, key: string) {
  const vocab = await loadSchemeVocab(db, { key });
  const typeIds = vocab.types.map((t) => t.id);
  const linkTypeIds = [...vocab.linkTypeByTypeKey.values()].map((lt) => lt.id);
  const [placements, allOptions, childTypes, targetTypes] = await Promise.all([
    typeIds.length ? db.select().from(itemTypeFields).where(inArray(itemTypeFields.itemTypeId, typeIds)) : [],
    db.select().from(options).where(inArray(options.optionSetId, [...new Set([...vocab.fieldById.values()].map((f) => f.optionSetId).filter((x): x is number => x != null))])),
    typeIds.length ? db.select().from(itemTypeChildTypes).where(inArray(itemTypeChildTypes.parentTypeId, typeIds)) : [],
    // linkType.setTargetTypes is a full delete+reinsert replace — the client
    // chip editor must seed its selections from the current rows here so a
    // toggle can diff against what's actually in the DB instead of wiping it.
    linkTypeIds.length
      ? db.select().from(linkTypeTargetTypes).where(inArray(linkTypeTargetTypes.linkTypeId, linkTypeIds))
      : [],
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
    targetTypes,
    views: vocab.views,
    users: [...vocab.usersById.values()],
    childTypes,
    items,
  };
}

export type Board = Awaited<ReturnType<typeof buildBoard>>;
