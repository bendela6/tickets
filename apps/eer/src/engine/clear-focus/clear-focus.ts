// Remove every focus/dim/selection class and reset the focus state.

import type { EngineState } from '../types';

export function clearFocus(state: EngineState): void {
  for (const [, card] of state.els.cards) card.classList.remove('dim', 'focus', 'selected');
  for (const [, els] of state.els.edgeEls) els.g.classList.remove('dim', 'active', 'hot');
  for (const z of state.els.groupLayer.children) z.classList.remove('zone-selected', 'zone-dim');
  state.els.svg.classList.remove('edge-top');
  state.focus = null;
}
