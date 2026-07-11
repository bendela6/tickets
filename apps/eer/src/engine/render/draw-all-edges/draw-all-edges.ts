// Redraw every edge. A non-live pass recomputes pin fans + routes and resizes the
// visible pin bars; a live pass (mid-drag) just moves the cheap direct shapes.

import { computePinSlots } from '../../geometry/compute-pin-slots';
import { computeRoutes } from '../../routing/compute-routes';
import { cssEsc } from '../css-esc';
import { drawEdge } from '../draw-edge';
import { markConnectedPorts } from '../mark-connected-ports';
import type { EngineState } from '../../model/types';

export function drawAllEdges(state: EngineState, live?: boolean): void {
  if (!live) {
    computePinSlots(state.model); // fan shared ports before routing/drawing uses the endpoints
    if (state.view.routing !== 'curved') computeRoutes(state.model);
  }
  for (const rel of state.model.relationships) drawEdge(state, rel, live ?? false);
  markConnectedPorts(state);
  if (!live) sizePins(state);
}

// Grow each pin bar to span the connections fanned onto it (model._pinSpan).
function sizePins(state: EngineState): void {
  const els = state.els.cardLayer;
  for (const p of els.querySelectorAll('.port')) (p as HTMLElement).style.height = '';
  const span = state.model._pinSpan;
  if (!span) return;
  for (const [key, off] of span) {
    if (off <= 0) continue;
    const parts = key.split('|');
    const p = els.querySelector(
      `.port.${parts[2] === 'L' ? 'left' : 'right'}[data-entity="${cssEsc(parts[0]!)}"][data-field="${cssEsc(parts[1]!)}"]`,
    ) as HTMLElement | null;
    if (p) p.style.height = 2 * off + 11 + 'px';
  }
}
