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

export interface EdgeSlots {
  src: number;
  tgt: number;
}

export interface PinSlotResult {
  slots: Map<string, EdgeSlots>;
  pinSpan: Map<string, number>;
}

export function pinSlots(model: Model): PinSlotResult {
  interface End {
    rel: Relationship;
    which: 'src' | 'tgt';
    otherY: number;
  }
  const ports = new Map<string, End[]>();
  const slots = new Map<string, EdgeSlots>();

  // Initialize all relationships with default slot values
  for (const rel of model.relationships) {
    slots.set(rel.id, { src: 0, tgt: 0 });
  }

  for (const rel of model.relationships) {
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
      const slotEntry = slots.get(e.rel.id)!;
      if (e.which === 'src') {
        slotEntry.src = off;
      } else {
        slotEntry.tgt = off;
      }
    });
    span.set(key, ((n - 1) / 2) * gap);
  }
  return { slots, pinSpan: span };
}

export function computePinSlots(model: Model): void {
  const { slots, pinSpan } = pinSlots(model);
  for (const rel of model.relationships) {
    const s = slots.get(rel.id);
    rel._srcSlot = s?.src ?? 0;
    rel._tgtSlot = s?.tgt ?? 0;
  }
  model._pinSpan = pinSpan;
}
