import { describe, expect, it } from 'vitest';

import { loadModel } from './load-model';

describe('loadModel — cardinality warnings', () => {
  const model = {
    groups: [{ id: 'g', label: 'G' }],
    entities: [
      {
        id: 'items',
        group: 'g',
        fields: [{ name: 'id', type: 'int', role: 'pk' }],
      },
      {
        id: 'events',
        group: 'g',
        fields: [
          { name: 'id', type: 'bigint', role: 'pk' },
          { name: 'aggregate_id', type: 'int' }, // untagged, as in the source
        ],
      },
      {
        id: 'outbox',
        group: 'g',
        fields: [{ name: 'event_id', type: 'bigint', role: 'pk' }], // identifying PK
      },
    ],
    relationships: [
      // items.id (pk) -> events.aggregate_id (untagged): previously a fallback warning.
      { id: 'istream', source: 'items', sourceField: 'id', target: 'events', targetField: 'aggregate_id' },
      // events.id (pk) -> outbox.event_id (pk): identifying, must be 1-1.
      { id: 'e-outbox', source: 'events', sourceField: 'id', target: 'outbox', targetField: 'event_id' },
    ],
  };

  it('no longer warns on keyed-endpoint or identifying relationships', () => {
    const { model: m, errors, warnings } = loadModel(model);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(m).not.toBeNull();
  });

  it('assigns 1-n to the keyed-parent edge and 1-1 to the identifying edge', () => {
    const { model: m } = loadModel(model);
    expect(m!.relById.get('istream')!.cardinality).toBe('1-n');
    expect(m!.relById.get('e-outbox')!.cardinality).toBe('1-1');
  });
});

describe('loadModel — validation', () => {
  it('rejects a non-object root', () => {
    expect(loadModel(null).errors.length).toBeGreaterThan(0);
    expect(loadModel('nope').errors.length).toBeGreaterThan(0);
  });

  it('errors on unknown reference targets and missing fields', () => {
    const { errors } = loadModel({
      groups: [{ id: 'g' }],
      entities: [{ id: 'a', group: 'g', fields: [{ name: 'id', role: 'pk' }] }],
      relationships: [
        { id: 'x', source: 'a', sourceField: 'id', target: 'ghost', targetField: 'id' },
        { id: 'y', source: 'a', sourceField: 'nope', target: 'a', targetField: 'id' },
      ],
    });
    expect(errors.some((e) => e.includes('ghost'))).toBe(true);
    expect(errors.some((e) => e.includes('"a.nope" does not exist'))).toBe(true);
  });

  it('flattens too-deep nesting with a warning (one level only)', () => {
    const { model, warnings } = loadModel({
      groups: [
        { id: 'z', label: 'Z' },
        { id: 's', label: 'S', parent: 'z' },
        { id: 'deep', label: 'D', parent: 's' },
      ],
      entities: [{ id: 'a', group: 'deep', fields: [{ name: 'id', role: 'pk' }] }],
      relationships: [],
    });
    expect(warnings.some((w) => w.includes('one level'))).toBe(true);
    expect(model!.groups.find((g) => g.id === 'deep')!.parent).toBeNull();
  });

  it('accepts object-shaped endpoints ({ entity, field })', () => {
    const { model, errors } = loadModel({
      groups: [{ id: 'g' }],
      entities: [
        { id: 'a', group: 'g', fields: [{ name: 'id', role: 'pk' }] },
        { id: 'b', group: 'g', fields: [{ name: 'a_id', role: 'fk' }] },
      ],
      relationships: [{ id: 'r', source: { entity: 'a', field: 'id' }, target: { entity: 'b', field: 'a_id' } }],
    });
    expect(errors).toEqual([]);
    expect(model!.relById.get('r')).toMatchObject({ source: 'a', sourceField: 'id', target: 'b', targetField: 'a_id' });
  });
});
