import { describe, expect, it } from 'vitest';

import { buildModel, fkTo, pkField } from '../../test/models';
import { edgeSides } from '../edge-sides';
import { portKey } from '../port-key';
import { computePinSlots, SLOT_GAP } from './compute-pin-slots';

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

describe('computePinSlots', () => {
  it('fans a shared pin symmetrically, SLOT_GAP apart, ordered by the far end', () => {
    const model = buildModel(sharedPinRaw());
    computePinSlots(model);
    const rA = model.relById.get('r-a')!;
    const rB = model.relById.get('r-b')!;
    // a is packed above b, so r-a takes the upper slot.
    expect(model.entityById.get('a')!.y).toBeLessThan(model.entityById.get('b')!.y);
    expect(rA._srcSlot).toBe(-SLOT_GAP / 2);
    expect(rB._srcSlot).toBe(SLOT_GAP / 2);
    expect(rA._srcSlot! + rB._srcSlot!).toBe(0); // symmetric around the pin centre
  });

  it('gives single-edge pins slot 0', () => {
    const model = buildModel(sharedPinRaw());
    computePinSlots(model);
    expect(model.relById.get('r-a')!._tgtSlot).toBe(0);
    expect(model.relById.get('r-b')!._tgtSlot).toBe(0);
  });

  it('records each port half-span in model._pinSpan', () => {
    const model = buildModel(sharedPinRaw());
    computePinSlots(model);
    const rA = model.relById.get('r-a')!;
    const { s, t } = edgeSides(model, rA);
    expect(model._pinSpan!.get(portKey('users', 'id', s))).toBe(SLOT_GAP / 2); // 2 ends
    expect(model._pinSpan!.get(portKey('a', 'users_id', t))).toBe(0); // 1 end
  });

  it('resets self-loop slots to zero (they never join a fan)', () => {
    const model = buildModel(); // twoZoneRaw carries the users→users self-loop
    computePinSlots(model);
    const self = model.relById.get('self')!;
    expect(self._srcSlot).toBe(0);
    expect(self._tgtSlot).toBe(0);
  });
});
