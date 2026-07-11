// Focus a zone/subgroup: its members, everything they connect to, and those
// edges stay lit; the focused box is selected, other boxes dim.

import { applyDim } from '../apply-dim';
import { entityIdsInGroup } from '../entity-ids-in-group';
import { subgroupIdsOf } from '../subgroup-ids-of';
import type { EngineState } from '../types';

export function focusGroup(state: EngineState, groupId: string): void {
  const inGroup = entityIdsInGroup(state.model, groupId);
  const related = new Set<string>(inGroup);
  const relEdges = new Set<string>();
  for (const rel of state.model.relationships) {
    if (inGroup.has(rel.source) || inGroup.has(rel.target)) {
      relEdges.add(rel.id);
      related.add(rel.source);
      related.add(rel.target);
    }
  }
  applyDim(state, related, relEdges);
  // The focused group is selected; a zone keeps its own subgroup boxes lit (they
  // are part of it), everything else dims.
  const lit = new Set<string>([groupId, ...subgroupIdsOf(state.model, groupId)]);
  for (const z of state.els.groupLayer.children) {
    const gid = (z as HTMLElement).dataset.group ?? '';
    z.classList.toggle('zone-selected', gid === groupId);
    z.classList.toggle('zone-dim', !lit.has(gid));
  }
  state.focus = { type: 'group', id: groupId };
}
