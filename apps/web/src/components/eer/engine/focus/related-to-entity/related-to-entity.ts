import type { Model } from '../../model/types';

export interface RelatedSets {
  entities: Set<string>;
  edges: Set<string>;
}

export function relatedToEntity(model: Model, id: string): RelatedSets {
  const entities = new Set<string>([id]);
  const edges = new Set<string>();
  for (const rel of model.relationships) {
    if (rel.source === id || rel.target === id) {
      edges.add(rel.id);
      entities.add(rel.source);
      entities.add(rel.target);
    }
  }
  return { entities, edges };
}
