// Ids of every descendant subgroup of a group — its direct children and,
// transitively, theirs, to any depth (empty for a leaf). Callers use this to
// treat a group and its whole subtree as a unit: gathering the entities inside
// a zone, lighting a focused zone's nested boxes, and dragging a zone together
// with everything nested in it. (At one level of nesting the descendant set and
// the direct-child set coincide — this generalizes it to unbounded depth.)

import type { Model } from '../../model/types';

export function subgroupIdsOf(model: Model, groupId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const queue = model.groups.filter((g) => g.parent === groupId).map((g) => g.id);
  for (const start of queue) seen.add(start);
  while (queue.length) {
    const cur = queue.shift()!;
    out.push(cur);
    for (const g of model.groups) {
      if (g.parent === cur && !seen.has(g.id)) {
        seen.add(g.id);
        queue.push(g.id);
      }
    }
  }
  return out;
}
