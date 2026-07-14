// World-space endpoints of a relationship: the two field ports it connects, each
// shifted by its pin slot so edges sharing a port fan out along the bar.

import { edgeSides } from '../edge-sides';
import { fieldIndex } from '../field-index';
import { portWorldPos } from '../port-world-pos';
import type { Entity, Model, Point, Relationship, Side } from '../../model/types';
import type { EdgeSlots } from '../compute-pin-slots';

export interface EdgeEndpoints {
  p1: Point;
  p2: Point;
  s: Side;
  t: Side;
  self: boolean;
  A: Entity;
  B: Entity;
}

export function edgeEndpoints(model: Model, rel: Relationship, slot?: EdgeSlots): EdgeEndpoints {
  const A = model.entityById.get(rel.source)!;
  const B = model.entityById.get(rel.target)!;
  const ai = fieldIndex(A, rel.sourceField);
  const bi = fieldIndex(B, rel.targetField);
  const { s, t } = edgeSides(model, rel);
  const p1 = portWorldPos(A, ai, s);
  const p2 = portWorldPos(B, bi, t);
  p1.y += slot?.src ?? 0;
  p2.y += slot?.tgt ?? 0;
  return { p1, p2, s, t, self: rel.source === rel.target, A, B };
}
