// Focus one entity: it, its neighbours, and their edges stay lit; the focused
// card gets the selected ring.

import { applyDim } from '../apply-dim';
import type { EngineState } from '../types';

export function focusEntity(state: EngineState, id: string): void {
  const related = new Set<string>([id]);
  const relEdges = new Set<string>();
  for (const rel of state.model.relationships) {
    if (rel.source === id || rel.target === id) {
      relEdges.add(rel.id);
      related.add(rel.source);
      related.add(rel.target);
    }
  }
  applyDim(state, related, relEdges);
  state.els.cards.get(id)?.classList.add('selected');
  state.focus = { type: 'entity', id };
}
