// Shared focus mechanic: keep `related` cards + `relEdges` edges lit, dim the
// rest. Class toggles ONLY — never coordinates (no reflow, no drift).

import type { EngineState } from '../types';

export function applyDim(state: EngineState, related: Set<string>, relEdges: Set<string>): void {
  state.els.svg.classList.remove('edge-top'); // only edge-isolate lifts edges above cards
  for (const [id, card] of state.els.cards) {
    card.classList.toggle('dim', !related.has(id));
    card.classList.toggle('focus', related.has(id));
    card.classList.remove('selected');
  }
  for (const [rid, els] of state.els.edgeEls) {
    els.g.classList.toggle('active', relEdges.has(rid));
    els.g.classList.toggle('dim', !relEdges.has(rid));
    els.g.classList.remove('hot');
  }
}
