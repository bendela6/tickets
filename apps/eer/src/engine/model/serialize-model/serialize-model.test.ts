import { describe, expect, it } from 'vitest';

import { buildModel, pkField } from '../../../test/models';
import { loadModel } from '../load-model';
import { packLayout } from '../../layout/pack-layout';
import { serializeModel } from './serialize-model';
import type { Relationship } from '../types';

// fk-kind relationships are re-derived on load from fk-role fields, so their ids
// follow the derived scheme (`e-<ref>.<refField>-><entity>.<field>`) rather than
// whatever hand-written id the fixture used (e.g. 'u-o') — compare endpoint
// tuples instead of ids wherever fk-kind rels are involved.
const tuple = (r: Pick<Relationship, 'source' | 'sourceField' | 'target' | 'targetField' | 'kind'>) =>
  `${r.source}.${r.sourceField}->${r.target}.${r.targetField}:${r.kind}`;

describe('serializeModel', () => {
  it('roundtrips: loading the serialized form reproduces entities, fields, colors and layout', () => {
    const m1 = buildModel();
    const colors = new Map([['z1', '#123456']]);
    const raw = serializeModel(m1, colors);
    const { model: m2, errors } = loadModel(raw);
    expect(errors).toEqual([]);
    const packed = packLayout(m2!);
    expect(packed.entities.map((e) => e.id)).toEqual(m1.entities.map((e) => e.id));
    expect(packed.entityById.get('orders')!.fields).toEqual(m1.entityById.get('orders')!.fields);
    expect(packed.colors.get('z1')).toBe('#123456');
    expect(packed.entityById.get('users')!.x).toBe(m1.entityById.get('users')!.x); // layout survived
    expect(packed.relationships.map(tuple).sort()).toEqual(m1.relationships.map(tuple).sort());
  });

  it('omits fk-kind relationships from the serialized output but keeps other kinds', () => {
    const raw0 = {
      groups: [{ id: 'g', label: 'G', order: 0 }],
      entities: [
        { id: 'a', group: 'g', fields: [pkField] },
        { id: 'b', group: 'g', fields: [pkField, { name: 'a_id', type: 'int', role: 'fk', ref: 'a', refField: 'id' }] },
        { id: 'c', group: 'g', fields: [pkField] },
      ],
      relationships: [
        { id: 'a-b-fk', source: 'a', sourceField: 'id', target: 'b', targetField: 'a_id', kind: 'fk' },
        { id: 'a-c-nm', source: 'a', sourceField: 'id', target: 'c', targetField: 'id', kind: 'nm' },
      ],
    };
    const m1 = buildModel(raw0);
    const out = serializeModel(m1, new Map());
    expect((out.relationships as { id: string }[]).map((r) => r.id)).toEqual(['a-c-nm']);
  });
});
