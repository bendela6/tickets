import { describe, expect, it } from 'vitest';

import { entityIdsInGroup, subgroupIdsOf, zoneIdOf } from './groups';
import { packLayout } from './layout';
import { loadModel } from './model';
import type { Entity, GroupBounds, Model } from './types';

// A zone `z` with a nested subgroup `s` (two members) plus one loose card.
function nestedModel(): Model {
  const { model, errors } = loadModel({
    groups: [
      { id: 'z', label: 'Zone', order: 0 },
      { id: 's', label: 'Sub', parent: 'z', order: 1 },
    ],
    entities: [
      { id: 'loose', group: 'z', fields: [{ name: 'id', type: 'int', role: 'pk' }] },
      { id: 'm1', group: 's', fields: [{ name: 'id', type: 'int', role: 'pk' }] },
      { id: 'm2', group: 's', fields: [{ name: 'id', type: 'int', role: 'pk' }] },
    ],
    relationships: [],
  });
  expect(errors).toEqual([]);
  return model!;
}

const contains = (outer: GroupBounds, inner: GroupBounds) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

const entityInside = (b: GroupBounds, e: Entity) =>
  e.x >= b.x && e.y >= b.y && e.x + e._w <= b.x + b.w && e.y + e._h <= b.y + b.h;

describe('group hierarchy helpers', () => {
  const model = nestedModel();

  it('resolves a subgroup to its parent zone and a zone to itself', () => {
    expect(zoneIdOf(model, 's')).toBe('z');
    expect(zoneIdOf(model, 'z')).toBe('z');
  });

  it('lists subgroups of a zone', () => {
    expect(subgroupIdsOf(model, 'z')).toEqual(['s']);
    expect(subgroupIdsOf(model, 's')).toEqual([]);
  });

  it('collects members: a zone includes its subgroups, a subgroup its own', () => {
    expect(entityIdsInGroup(model, 'z')).toEqual(new Set(['loose', 'm1', 'm2']));
    expect(entityIdsInGroup(model, 's')).toEqual(new Set(['m1', 'm2']));
  });
});

describe('packLayout nesting', () => {
  const model = nestedModel();
  packLayout(model);

  const zone = model._groupBounds.find((b) => b.id === 'z')!;
  const sub = model._groupBounds.find((b) => b.id === 's')!;

  it('emits both a zone box (level 0) and a subgroup box (level 1)', () => {
    expect(zone.level).toBe(0);
    expect(sub.level).toBe(1);
    expect(sub.parent).toBe('z');
  });

  it('nests the subgroup box fully inside its zone box', () => {
    expect(contains(zone, sub)).toBe(true);
  });

  it('places every subgroup member inside the subgroup box', () => {
    for (const id of ['m1', 'm2']) {
      expect(entityInside(sub, model.entityById.get(id)!)).toBe(true);
    }
  });

  it('keeps the loose card inside the zone but outside the subgroup', () => {
    const loose = model.entityById.get('loose')!;
    expect(entityInside(zone, loose)).toBe(true);
    expect(entityInside(sub, loose)).toBe(false);
  });
});
