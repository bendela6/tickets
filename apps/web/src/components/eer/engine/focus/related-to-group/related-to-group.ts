import type { Model } from '../../model/types';
import type { RelatedSets } from '../related-to-entity';
import { entityIdsInGroup } from '../../groups/entity-ids-in-group';
import { subgroupIdsOf } from '../../groups/subgroup-ids-of';

export interface GroupRelatedSets extends RelatedSets {
  litGroups: Set<string>;
}

export function relatedToGroup(model: Model, groupId: string): GroupRelatedSets {
  const inGroup = entityIdsInGroup(model, groupId);
  const entities = new Set<string>(inGroup);
  const edges = new Set<string>();
  for (const rel of model.relationships) {
    if (inGroup.has(rel.source) || inGroup.has(rel.target)) {
      edges.add(rel.id);
      entities.add(rel.source);
      entities.add(rel.target);
    }
  }
  return { entities, edges, litGroups: new Set([groupId, ...subgroupIdsOf(model, groupId)]) };
}
