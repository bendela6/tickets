// Drop hover highlights — except on an isolated edge, which stays hot.

import type { EngineState } from '../../model/types';

export function clearFieldHighlight(state: EngineState): void {
  for (const [rid, els] of state.els.edgeEls) {
    if (state.focus && state.focus.type === 'edge' && state.focus.id === rid) continue;
    els.g.classList.remove('hot');
  }
}
