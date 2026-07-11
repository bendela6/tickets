// Reposition zones/cards/edges from freshly-packed coords without rebuilding DOM.

import { drawAllEdges } from '../draw-all-edges';
import { positionEntity } from '../position-entity';
import type { EngineState } from '../../model/types';

export function relayout(state: EngineState): void {
  const zones = state.els.groupLayer.children;
  state.model._groupBounds.forEach((b, i) => {
    const z = zones[i] as HTMLElement | undefined;
    if (!z) return;
    z.style.left = b.x + 'px';
    z.style.top = b.y + 'px';
    z.style.width = b.w + 'px';
    z.style.height = b.h + 'px';
  });
  state.els.svg.style.width = state.model._content.w + 'px';
  state.els.svg.style.height = state.model._content.h + 'px';
  for (const e of state.model.entities) {
    // Re-apply width: packLayout may have re-measured (e.g. once webfonts load),
    // and the card's CSS width must track e._w or ports drift off the dots.
    const card = state.els.cards.get(e.id);
    if (card) card.style.width = e._w + 'px';
    positionEntity(state, e.id);
  }
  drawAllEdges(state);
}
