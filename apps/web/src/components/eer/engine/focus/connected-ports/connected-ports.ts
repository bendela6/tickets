import type { Model } from '../../model/types';
import { edgeSides } from '../../geometry/edge-sides';
import { endKinds } from '../../model/end-kinds';
import { portKey } from '../../geometry/port-key';

export function connectedPorts(model: Model, hiddenEdges: ReadonlySet<string>): Set<string> {
  const on = new Set<string>();
  for (const rel of model.relationships) {
    if (hiddenEdges.has(rel.id)) continue;
    const { s, t } = edgeSides(model, rel);
    const [ks, kt] = endKinds(rel.cardinality);
    if (ks === 'one') on.add(portKey(rel.source, rel.sourceField, s));
    if (kt === 'one') on.add(portKey(rel.target, rel.targetField, t));
  }
  return on;
}
