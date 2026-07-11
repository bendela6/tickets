// Re-append an edge's group so it paints above its siblings (SVG has no z-index).

import type { EngineState } from '../types';

export function raiseEdge(state: EngineState, relId: string): void {
  const els = state.els.edgeEls.get(relId);
  if (els) state.els.svg.appendChild(els.g);
}
