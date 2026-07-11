// The top-level zone a group belongs to. A zone resolves to itself; a subgroup
// resolves to its parent zone. (Groups are one level deep.)

import type { Model } from '../types';

export function zoneIdOf(model: Model, groupId: string): string {
  const g = model.groups.find((x) => x.id === groupId);
  return g?.parent ?? groupId;
}
