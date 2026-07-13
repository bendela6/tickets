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

describe('loadModel — fk-derived relationships', () => {
  it('derives a relationship from an fk field when relationships is empty', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        { id: 'users', group: 'g', fields: [{ name: 'id', type: 'int', role: 'pk' }] },
        {
          id: 'orders',
          group: 'g',
          fields: [
            { name: 'id', type: 'int', role: 'pk' },
            { name: 'user_id', type: 'int', role: 'fk', ref: 'users', refField: 'id' },
          ],
        },
      ],
      relationships: [],
    };
    const { model, errors } = loadModel(raw);
    expect(errors).toEqual([]);
    expect(model!.relationships).toHaveLength(1);
    const rel = model!.relationships[0]!;
    expect(rel).toMatchObject({
      id: 'e-users.id->orders.user_id',
      source: 'users',
      sourceField: 'id',
      target: 'orders',
      targetField: 'user_id',
      kind: 'fk',
      cardinality: '1-n',
      cardinalityInferred: true,
      label: null,
    });
    expect(model!.relById.get('e-users.id->orders.user_id')).toBe(rel);
  });

  it('does not duplicate an fk field that already has a matching explicit relationship', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        { id: 'users', group: 'g', fields: [{ name: 'id', type: 'int', role: 'pk' }] },
        {
          id: 'orders',
          group: 'g',
          fields: [
            { name: 'id', type: 'int', role: 'pk' },
            { name: 'user_id', type: 'int', role: 'fk', ref: 'users', refField: 'id' },
          ],
        },
      ],
      relationships: [{ id: 'custom-id', source: 'users', sourceField: 'id', target: 'orders', targetField: 'user_id' }],
    };
    const { model, errors } = loadModel(raw);
    expect(errors).toEqual([]);
    expect(model!.relationships).toHaveLength(1);
    expect(model!.relationships[0]!.id).toBe('custom-id');
  });

  it('does not derive when the fk field has no ref, or the ref is unknown', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        { id: 'a', group: 'g', fields: [{ name: 'id', type: 'int', role: 'pk' }, { name: 'b_id', type: 'int', role: 'fk' }] },
      ],
      relationships: [],
    };
    const { model } = loadModel(raw);
    expect(model!.relationships).toEqual([]);
  });
});

describe('loadModel — colors and saved layout', () => {
  it('reads optional colors, entity x/y and group bounds into the model', () => {
    const raw = {
      colors: { z1: '#112233', users: '#445566' },
      groups: [{ id: 'z1', label: 'Z', order: 0, bounds: { x: 5, y: 6, w: 700, h: 500 } }],
      entities: [{ id: 'users', group: 'z1', x: 40, y: 50, fields: [{ name: 'id', type: 'int', role: 'pk' }] }],
    };
    const { model, errors } = loadModel(raw);
    expect(errors).toEqual([]);
    expect(model!.colors.get('z1')).toBe('#112233');
    expect(model!._savedLayout!.entities.get('users')).toEqual({ x: 40, y: 50 });
    expect(model!._savedLayout!.groups.get('z1')).toEqual({ x: 5, y: 6, w: 700, h: 500 });
  });

  it('defaults colors to an empty map and savedLayout to undefined', () => {
    const { model } = loadModel({ groups: [{ id: 'z', label: 'Z' }], entities: [{ id: 'e', group: 'z', fields: [{ name: 'id' }] }] });
    expect(model!.colors.size).toBe(0);
    expect(model!._savedLayout).toBeUndefined();
  });
});
