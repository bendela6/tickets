import { describe, expect, it } from 'vitest';

import { buildModel } from '../../../test/models';
import { loadModel } from '../load-model';
import { packLayout } from '../../layout/pack-layout';
import { serializeModel } from './serialize-model';

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
    // fk relationships are re-derived on load, non-fk kinds are serialized explicitly
    expect(packed.relationships.map((r) => r.id).sort()).toEqual(m1.relationships.map((r) => r.id).sort());
  });
});
