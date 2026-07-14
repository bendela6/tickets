// Small model fixtures shared by engine/component tests. `buildModel` returns a
// loaded + packed model, ready for geometry/routing/scene work.

import { loadModel } from '../engine/model/load-model';
import { packLayout } from '../engine/layout/pack-layout';
import type { Model } from '../engine/model/types';

export const pkField = { name: 'id', type: 'int', role: 'pk' };
export const fkTo = (ref: string, name = ref + '_id') => ({ name, type: 'int', role: 'fk', ref, refField: 'id' });

// Two zones, three entities, two FK edges across/within zones, one self-loop.
export function twoZoneRaw() {
  return {
    meta: { title: 'Fixture', description: 'test model' },
    view: { routing: 'avoid' },
    kinds: [
      { id: 'fk', label: 'FK constraint' },
      { id: 'nm', label: 'Many-to-many', style: 'dashed' },
    ],
    groups: [
      { id: 'z1', label: 'Zone One', order: 0 },
      { id: 'z2', label: 'Zone Two', order: 1 },
    ],
    entities: [
      {
        id: 'users',
        group: 'z1',
        fields: [
          pkField,
          { name: 'name', type: 'text' },
          { name: 'manager_id', type: 'int', role: 'fk', ref: 'users', refField: 'id' },
        ],
      },
      { id: 'orders', group: 'z2', fields: [pkField, fkTo('users'), fkTo('tags', 'tag_id')] },
      { id: 'tags', group: 'z2', fields: [pkField] },
    ],
    relationships: [
      { id: 'u-o', source: 'users', sourceField: 'id', target: 'orders', targetField: 'users_id', kind: 'fk' },
      { id: 't-o', source: 'tags', sourceField: 'id', target: 'orders', targetField: 'tag_id', kind: 'fk' },
      { id: 'self', source: 'users', sourceField: 'id', target: 'users', targetField: 'manager_id', kind: 'fk' },
    ],
  };
}

// A zone `z` with a nested subgroup `s` (two members) plus one loose card.
export function nestedRaw() {
  return {
    groups: [
      { id: 'z', label: 'Zone', order: 0 },
      { id: 's', label: 'Sub', parent: 'z', order: 1 },
    ],
    entities: [
      { id: 'loose', group: 'z', fields: [pkField] },
      { id: 'm1', group: 's', fields: [pkField] },
      { id: 'm2', group: 's', fields: [pkField, fkTo('m1')] },
    ],
    relationships: [{ id: 'm1-m2', source: 'm1', sourceField: 'id', target: 'm2', targetField: 'm1_id' }],
  };
}

export function buildModel(raw: unknown = twoZoneRaw()): Model {
  const { model, errors } = loadModel(raw);
  if (!model || errors.length) throw new Error('fixture model invalid: ' + errors.join('; '));
  return packLayout(model);
}
