import { describe, expect, it } from 'vitest';

import { buildModel, fkTo, pkField } from '../../../test/models';
import { edgeSides } from '../edge-sides';
import { portKey } from '../port-key';
import { pinSlots, SLOT_GAP } from './compute-pin-slots';

// One pk referenced by two FKs from a second zone: users.id becomes a shared pin
// with two edge-ends; each FK's own port stays a single-edge pin.
function sharedPinRaw() {
  return {
    groups: [
      { id: 'z1', label: 'Left', order: 0 },
      { id: 'z2', label: 'Right', order: 1 },
    ],
    entities: [
      { id: 'users', group: 'z1', fields: [pkField] },
      { id: 'a', group: 'z2', fields: [pkField, fkTo('users')] },
      { id: 'b', group: 'z2', fields: [pkField, fkTo('users')] },
    ],
    relationships: [
      { id: 'r-a', source: 'users', sourceField: 'id', target: 'a', targetField: 'users_id' },
      { id: 'r-b', source: 'users', sourceField: 'id', target: 'b', targetField: 'users_id' },
    ],
  };
}

describe('pinSlots', () => {
  it('fans a shared pin symmetrically, SLOT_GAP apart, ordered by the far end', () => {
    const model = buildModel(sharedPinRaw());
    const { slots } = pinSlots(model);
    const sA = slots.get('r-a')!;
    const sB = slots.get('r-b')!;
    // a is packed above b, so r-a takes the upper slot.
    expect(model.entityById.get('a')!.y).toBeLessThan(model.entityById.get('b')!.y);
    expect(sA.src).toBe(-SLOT_GAP / 2);
    expect(sB.src).toBe(SLOT_GAP / 2);
    expect(sA.src + sB.src).toBe(0); // symmetric around the pin centre
  });

  it('gives single-edge pins slot 0', () => {
    const model = buildModel(sharedPinRaw());
    const { slots } = pinSlots(model);
    expect(slots.get('r-a')!.tgt).toBe(0);
    expect(slots.get('r-b')!.tgt).toBe(0);
  });

  it('records each port half-span in the returned pinSpan map', () => {
    const model = buildModel(sharedPinRaw());
    const { pinSpan } = pinSlots(model);
    const rA = model.relById.get('r-a')!;
    const { s, t } = edgeSides(model, rA);
    expect(pinSpan.get(portKey('users', 'id', s))).toBe(SLOT_GAP / 2); // 2 ends
    expect(pinSpan.get(portKey('a', 'users_id', t))).toBe(0); // 1 end
  });

  it('resets self-loop slots to zero (they never join a fan)', () => {
    const model = buildModel(); // twoZoneRaw carries the users→users self-loop
    const { slots } = pinSlots(model);
    const self = slots.get('self')!;
    expect(self.src).toBe(0);
    expect(self.tgt).toBe(0);
  });

  it('does not mutate the model', () => {
    const model = buildModel(); // twoZoneRaw: users.id feeds u-o and self → shared port fans
    const before = JSON.stringify(model, (_, v: unknown) => (v instanceof Map ? [...v] : v));
    const { slots, pinSpan } = pinSlots(model);
    const after = JSON.stringify(model, (_, v: unknown) => (v instanceof Map ? [...v] : v));
    expect(after).toBe(before);
    expect(slots.size).toBe(model.relationships.length);
    expect(pinSpan.size).toBeGreaterThan(0);
  });
});
