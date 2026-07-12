// Light exactly the pins that carry a visible connector. The pin bar sits on the
// "one" end only; the "many" end shows a crow's-foot instead.

import { cssEsc } from '../../dom/css-esc';
import { edgeSides } from '../../geometry/edge-sides';
import { endKinds } from '../../model/end-kinds';
import type { EngineState, Side } from '../../model/types';

export function markConnectedPorts(state: EngineState): void {
  for (const p of state.els.cardLayer.querySelectorAll('.port.connected')) p.classList.remove('connected');
  for (const rel of state.model.relationships) {
    const els = state.els.edgeEls.get(rel.id)!;
    if (els.g.classList.contains('hidden')) continue;
    const { s, t } = edgeSides(state.model, rel);
    const [ks, kt] = endKinds(rel.cardinality);
    if (ks === 'one') portEl(state, rel.source, rel.sourceField, s)?.classList.add('connected');
    if (kt === 'one') portEl(state, rel.target, rel.targetField, t)?.classList.add('connected');
  }
}

function portEl(state: EngineState, entity: string, field: string, side: Side): Element | null {
  return state.els.cardLayer.querySelector(
    `.port.${side === 'L' ? 'left' : 'right'}[data-entity="${cssEsc(entity)}"][data-field="${cssEsc(field)}"]`,
  );
}
