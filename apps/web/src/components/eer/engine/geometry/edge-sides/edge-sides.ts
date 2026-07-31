// Which side (L/R) each end of a relationship exits from. Pick the L/R × L/R
// combination whose two ports are closest — for side-by-side cards this is the
// facing sides; for cards stacked vertically it connects both on the SAME side
// (shortest path, no wrap-around).

import { fieldIndex } from '../field-index';
import { portWorldPos } from '../port-world-pos';
import type { Model, Relationship, Side } from '../../model/types';

export function edgeSides(model: Model, rel: Relationship): { s: Side; t: Side } {
  if (rel.source === rel.target) return { s: 'R', t: 'R' };
  const A = model.entityById.get(rel.source)!;
  const B = model.entityById.get(rel.target)!;
  const ai = fieldIndex(A, rel.sourceField);
  const bi = fieldIndex(B, rel.targetField);
  const sides: Side[] = ['L', 'R'];
  let best: { s: Side; t: Side } = { s: 'R', t: 'L' };
  let bestD = Infinity;
  for (const s of sides) {
    for (const t of sides) {
      const p1 = portWorldPos(A, ai, s);
      const p2 = portWorldPos(B, bi, t);
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (d < bestD) {
        bestD = d;
        best = { s, t };
      }
    }
  }
  return best;
}
