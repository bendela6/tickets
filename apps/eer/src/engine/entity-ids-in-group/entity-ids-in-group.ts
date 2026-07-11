// Every entity that belongs to a group: for a subgroup, its direct members; for
// a zone, its direct members plus everything in its subgroups.

import { subgroupIdsOf } from '../subgroup-ids-of';
import type { Model } from '../types';

export function entityIdsInGroup(model: Model, groupId: string): Set<string> {
  const childIds = new Set(subgroupIdsOf(model, groupId));
  const ids = new Set<string>();
  for (const e of model.entities) {
    if (e.group === groupId || childIds.has(e.group)) ids.add(e.id);
  }
  return ids;
}
