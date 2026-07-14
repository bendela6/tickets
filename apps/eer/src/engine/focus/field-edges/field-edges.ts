import type { Model } from '../../model/types';

export function fieldEdges(model: Model, entityId: string, field: string): Set<string> {
  const edges = new Set<string>();
  for (const rel of model.relationships) {
    if ((rel.source === entityId && rel.sourceField === field) || (rel.target === entityId && rel.targetField === field))
      edges.add(rel.id);
  }
  return edges;
}
