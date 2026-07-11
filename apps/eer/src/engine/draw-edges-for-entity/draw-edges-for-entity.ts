// Redraw only the edges touching one entity (cheap drag feedback).

import { drawEdge } from '../draw-edge';
import { markConnectedPorts } from '../mark-connected-ports';
import type { EngineState } from '../types';

export function drawEdgesForEntity(state: EngineState, id: string, live?: boolean): void {
  for (const rel of state.model.relationships) {
    if (rel.source === id || rel.target === id) drawEdge(state, rel, live ?? false);
  }
  markConnectedPorts(state);
}
