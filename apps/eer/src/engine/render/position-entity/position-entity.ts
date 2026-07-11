// Move a card's DOM to its model coordinates (transform only — no reflow).

import type { EngineState } from '../../model/types';

export function positionEntity(state: EngineState, id: string): void {
  const e = state.model.entityById.get(id)!;
  const card = state.els.cards.get(id)!;
  card.style.transform = `translate(${e.x}px, ${e.y}px)`;
}
