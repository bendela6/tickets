import type { Model } from '../../model/types';
import type { RelatedSets } from '../related-to-entity';

export function isolatedEdge(model: Model, relId: string): RelatedSets {
  const rel = model.relById.get(relId);
  if (!rel) return { entities: new Set(), edges: new Set() };
  return { entities: new Set([rel.source, rel.target]), edges: new Set([relId]) };
}
