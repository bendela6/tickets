// Swap in a new colour-override map and restamp every zone, card and edge hue
// custom property in place — colour never affects geometry, so nothing moves.

import { edgeColor } from '../edge-color';
import { entityColor } from '../entity-color';
import { groupColor } from '../group-color';
import type { EngineState } from '../../model/types';

export function setColors(state: EngineState, colors: ReadonlyMap<string, string> | undefined): void {
  state.colors = colors;
  for (const z of state.els.groupLayer.querySelectorAll<HTMLElement>('.zone')) {
    if (z.dataset.group) z.style.setProperty('--group-c', groupColor(state.model, z.dataset.group, colors));
  }
  for (const [id, card] of state.els.cards) {
    card.style.setProperty('--entity-c', entityColor(state.model, id, colors));
  }
  for (const rel of state.model.relationships) {
    state.els.edgeEls.get(rel.id)?.g.style.setProperty('--edge-c', edgeColor(state, rel.target));
  }
}
