// Light every edge attached to one field (hover affordance).

import type { EngineState } from '../../model/types';

export function highlightField(state: EngineState, entityId: string, field: string): void {
  const edges = new Set<string>();
  for (const rel of state.model.relationships) {
    if ((rel.source === entityId && rel.sourceField === field) || (rel.target === entityId && rel.targetField === field))
      edges.add(rel.id);
  }
  for (const [rid, els] of state.els.edgeEls) els.g.classList.toggle('hot', edges.has(rid));
}
