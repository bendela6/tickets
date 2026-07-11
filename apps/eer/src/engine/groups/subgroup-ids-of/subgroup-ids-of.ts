// Ids of the direct child subgroups of a zone (empty for a subgroup/leaf).

import type { Model } from '../../model/types';

export function subgroupIdsOf(model: Model, zoneId: string): string[] {
  return model.groups.filter((g) => g.parent === zoneId).map((g) => g.id);
}
