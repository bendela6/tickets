// The top-level zone a group belongs to: walk the parent chain to its root
// ancestor. A root group resolves to itself; a nested group (at any depth)
// resolves to the outermost group that contains it. The `seen` guard is
// belt-and-suspenders against a cyclic chain — load-model already breaks those.

import type { Model } from '../../model/types';

export function zoneIdOf(model: Model, groupId: string): string {
  let g = model.groups.find((x) => x.id === groupId);
  const seen = new Set<string>();
  while (g?.parent != null && !seen.has(g.id)) {
    seen.add(g.id);
    const parent = model.groups.find((x) => x.id === g!.parent);
    if (!parent) break;
    g = parent;
  }
  return g?.id ?? groupId;
}
