// Group-hierarchy helpers. Groups are one level deep: a top-level "zone" may
// contain "subgroups", and an entity's `group` points at whichever is innermost.
// These resolve between the two levels so callers don't special-case nesting.

import type { Model } from './types';

// The top-level zone a group belongs to. A zone resolves to itself; a subgroup
// resolves to its parent zone.
export function zoneIdOf(model: Model, groupId: string): string {
  const g = model.groups.find((x) => x.id === groupId);
  return g?.parent ?? groupId;
}

// Ids of the direct child subgroups of a zone (empty for a subgroup/leaf).
export function subgroupIdsOf(model: Model, zoneId: string): string[] {
  return model.groups.filter((g) => g.parent === zoneId).map((g) => g.id);
}

// Every entity that belongs to a group: for a subgroup, its direct members; for
// a zone, its direct members plus everything in its subgroups.
export function entityIdsInGroup(model: Model, groupId: string): Set<string> {
  const childIds = new Set(subgroupIdsOf(model, groupId));
  const ids = new Set<string>();
  for (const e of model.entities) {
    if (e.group === groupId || childIds.has(e.group)) ids.add(e.id);
  }
  return ids;
}

export function isZone(model: Model, groupId: string): boolean {
  const g = model.groups.find((x) => x.id === groupId);
  return !g?.parent;
}
