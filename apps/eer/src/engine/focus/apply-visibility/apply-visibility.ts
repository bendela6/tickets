// Apply the group/kind filter chips: hide cards of hidden zones, their boxes, and
// every edge that touches a hidden zone or a hidden kind.

import { markConnectedPorts } from '../../render/mark-connected-ports';
import { zoneIdOf } from '../../groups/zone-id-of';
import type { EngineState } from '../../model/types';

export function applyVisibility(state: EngineState): void {
  const hiddenGroups = state.hidden.groups; // holds zone ids (chips are zone-level)
  const hiddenKinds = state.hidden.kinds;
  const zoneHidden = (groupId: string) => hiddenGroups.has(zoneIdOf(state.model, groupId));
  for (const [id, card] of state.els.cards) {
    const e = state.model.entityById.get(id)!;
    card.classList.toggle('hidden', zoneHidden(e.group));
  }
  for (const z of state.els.groupLayer.children) {
    z.classList.toggle('hidden', zoneHidden((z as HTMLElement).dataset.group ?? ''));
  }
  for (const rel of state.model.relationships) {
    const els = state.els.edgeEls.get(rel.id)!;
    const A = state.model.entityById.get(rel.source)!;
    const B = state.model.entityById.get(rel.target)!;
    const hide = zoneHidden(A.group) || zoneHidden(B.group) || (rel.kind ? hiddenKinds.has(rel.kind) : false);
    els.g.classList.toggle('hidden', hide);
  }
  markConnectedPorts(state);
}
