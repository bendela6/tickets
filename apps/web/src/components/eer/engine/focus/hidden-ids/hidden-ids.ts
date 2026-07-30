import type { Model } from '../../model/types';
import { zoneIdOf } from '../../groups/zone-id-of';

export interface HiddenIds {
  entities: Set<string>;
  groups: Set<string>;
  edges: Set<string>;
}

export function hiddenIds(model: Model, hiddenGroups: ReadonlySet<string>, hiddenKinds: ReadonlySet<string>): HiddenIds {
  const zoneHidden = (groupId: string) => hiddenGroups.has(zoneIdOf(model, groupId));
  const entities = new Set<string>();
  for (const e of model.entities) if (zoneHidden(e.group)) entities.add(e.id);
  const groups = new Set<string>();
  for (const b of model._groupBounds) if (zoneHidden(b.id)) groups.add(b.id);
  const edges = new Set<string>();
  for (const rel of model.relationships) {
    const A = model.entityById.get(rel.source)!;
    const B = model.entityById.get(rel.target)!;
    if (zoneHidden(A.group) || zoneHidden(B.group) || (rel.kind ? hiddenKinds.has(rel.kind) : false)) edges.add(rel.id);
  }
  return { entities, groups, edges };
}
