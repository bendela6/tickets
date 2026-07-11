// Isolate a single relationship: only its two endpoints stay lit and the edge
// layer lifts above the cards so the path reads uninterrupted.

import { applyDim } from '../apply-dim';
import { raiseEdge } from '../raise-edge';
import type { EngineState } from '../types';

export function isolateEdge(state: EngineState, relId: string): void {
  const rel = state.model.relById.get(relId);
  if (!rel) return;
  applyDim(state, new Set([rel.source, rel.target]), new Set([relId]));
  raiseEdge(state, relId);
  state.els.svg.classList.add('edge-top'); // lift the isolated edge above the cards
  state.focus = { type: 'edge', id: relId };
}
