// Assign each edge-end a y-offset along its port so multiple lines into the same
// pin don't stack. Ends are ordered by where the other end sits, which keeps the
// fan from crossing itself. Records each port's half-span in model._pinSpan so the
// renderer can size the visible bar.

import { edgeSides } from '../edge-sides';
import { fieldIndex } from '../field-index';
import { portKey } from '../port-key';
import { portWorldPos } from '../port-world-pos';
import type { Model, Relationship } from '../../model/types';

export const SLOT_GAP = 8; // spacing between fanned connections — must exceed the casing width
const MAX_FAN = 48; // cap a pin bar's total span so heavily-referenced PKs stay compact

export function computePinSlots(model: Model): void {
  interface End {
    rel: Relationship;
    which: 'src' | 'tgt';
    otherY: number;
  }
  const ports = new Map<string, End[]>();
  for (const rel of model.relationships) {
    rel._srcSlot = 0;
    rel._tgtSlot = 0;
    if (rel.source === rel.target) continue;
    const A = model.entityById.get(rel.source);
    const B = model.entityById.get(rel.target);
    if (!A || !B) continue;
    const ai = fieldIndex(A, rel.sourceField);
    const bi = fieldIndex(B, rel.targetField);
    const { s, t } = edgeSides(model, rel);
    const pA = portWorldPos(A, ai, s);
    const pB = portWorldPos(B, bi, t);
    const ks = portKey(rel.source, rel.sourceField, s);
    const kt = portKey(rel.target, rel.targetField, t);
    (ports.get(ks) ?? ports.set(ks, []).get(ks)!).push({ rel, which: 'src', otherY: pB.y });
    (ports.get(kt) ?? ports.set(kt, []).get(kt)!).push({ rel, which: 'tgt', otherY: pA.y });
  }

  const span = new Map<string, number>();
  for (const [key, arr] of ports) {
    if (arr.length < 2) {
      span.set(key, 0);
      continue;
    }
    arr.sort((a, b) => a.otherY - b.otherY);
    const n = arr.length;
    const gap = Math.min(SLOT_GAP, MAX_FAN / (n - 1)); // tighten only when a pin is very busy
    arr.forEach((e, i) => {
      const off = (i - (n - 1) / 2) * gap;
      if (e.which === 'src') e.rel._srcSlot = off;
      else e.rel._tgtSlot = off;
    });
    span.set(key, ((n - 1) / 2) * gap);
  }
  model._pinSpan = span;
}
