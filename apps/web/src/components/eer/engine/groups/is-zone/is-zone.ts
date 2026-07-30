// Whether a group id names a top-level zone (unknown ids count as zones — an
// entity's group is validated at load, so this only sees real or top-level ids).

import type { Model } from '../../model/types';

export function isZone(model: Model, groupId: string): boolean {
  const g = model.groups.find((x) => x.id === groupId);
  return !g?.parent;
}
