import { describe, expect, it } from 'vitest';

import { loadModel } from './load-model';
import seedRaw from '../../../../models/items-platform.json';

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

describe('loadModel — relationships derive from constraints', () => {
  it('derives a relationship from an fk constraint when relationships is empty', () => {
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
    // 'rel:orders:c2' — orders' 2nd synthesised constraint (c1 is its pk).
    expect(rel).toMatchObject({
      id: 'rel:orders:c2',
      source: 'users',
      sourceField: 'id',
      target: 'orders',
      targetField: 'user_id',
      kind: 'fk',
      cardinality: '1-n',
      cardinalityInferred: true,
      label: null,
    });
    expect(model!.relById.get('rel:orders:c2')).toBe(rel);
  });

  // A pair the constraint would ALSO derive is always won by the derived edge —
  // "relationships ARE the foreign keys" — regardless of whatever custom id or
  // kind a stale hand-authored relationship for the same pair carries.
  it('an explicit relationship covering the same pair as a real fk constraint is dropped in favour of the derived one', () => {
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
    expect(model!.relationships[0]!.id).toBe('rel:orders:c2');
  });

  it('an explicit relationship authored in the reverse direction is also dropped in favour of the derived one', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        { id: 'a', group: 'g', fields: [{ name: 'id', type: 'int', role: 'pk' }] },
        {
          id: 'b',
          group: 'g',
          fields: [
            { name: 'id', type: 'int', role: 'pk' },
            { name: 'a_id', type: 'int', role: 'fk', ref: 'a', refField: 'id' },
          ],
        },
      ],
      // Reverse of the derivation's natural (ref -> owner) direction.
      relationships: [{ id: 'reversed', source: 'b', sourceField: 'a_id', target: 'a', targetField: 'id', kind: 'm2m', label: 'rev' }],
    };
    const { model, errors } = loadModel(raw);
    expect(errors).toEqual([]);
    expect(model!.relationships).toHaveLength(1);
    expect(model!.relationships[0]!.id).toBe('rel:b:c2');
  });

  it('a broken explicit rel (bad field) — a different pair from the real fk — does not suppress the genuine derivation', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        { id: 'a', group: 'g', fields: [{ name: 'id', type: 'int', role: 'pk' }] },
        {
          id: 'b',
          group: 'g',
          fields: [
            { name: 'id', type: 'int', role: 'pk' },
            { name: 'a_id', type: 'int', role: 'fk', ref: 'a', refField: 'id' },
          ],
        },
      ],
      // References a field that doesn't exist on "a" — kind is unset (not 'fk'),
      // and its pair ("a.nonexistent" <-> "b.a_id") differs from the real
      // derivable pair ("a.id" <-> "b.a_id"), so it survives alongside it.
      relationships: [{ id: 'broken', source: 'a', sourceField: 'nonexistent', target: 'b', targetField: 'a_id' }],
    };
    const { model, errors } = loadModel(raw);
    expect(errors.length).toBeGreaterThan(0);
    expect(model!.relationships.map((r) => r.id).sort()).toEqual(['broken', 'rel:b:c2']);
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

  // The ref'd entity existing isn't enough — it must still carry the named
  // refField. This models a file hand-edited after a pk rename (e.g. 'a.id' ->
  // 'a.key') where a dependent's fk field was never updated: `ref` still
  // resolves to a real entity, but `refField` ('id') no longer exists on it.
  // Deriving anyway would emit a relationship whose sourceField exists nowhere.
  it('does not derive when the fk field\'s refField does not exist on the ref\'d entity', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        { id: 'a', group: 'g', fields: [{ name: 'key', type: 'int', role: 'pk' }] }, // no 'id' field
        {
          id: 'b',
          group: 'g',
          fields: [
            { name: 'id', type: 'int', role: 'pk' },
            { name: 'a_id', type: 'int', role: 'fk', ref: 'a', refField: 'id' }, // stale: refers to 'a.id'
          ],
        },
      ],
      relationships: [],
    };
    const { model } = loadModel(raw);
    expect(model!.relationships).toEqual([]);
  });

  // Pinned against the real bundled seed model: every one of its 39 legacy
  // fk-role/ref fields synthesises an fk constraint (Task 2), and every
  // constraint now derives its own edge — including the 3 that used to be
  // hand-authored as kind:'m2m' (all 3 of the seed's m2m rels cover a pair a
  // real fk field also covers, so all 3 are dropped in favour of the derived
  // edge; see derive-relationships.ts). 39 constraints - 0 unresolvable = 40
  // (item_type_fields also carries a composite-looking pair via two separate
  // single-column fk fields, each deriving its own edge).
  it('derives exactly one edge per fk constraint for the real seed model (40, all kind fk)', () => {
    const { model, errors } = loadModel(seedRaw);
    expect(errors).toEqual([]);
    expect(model!.relationships).toHaveLength(40);
    expect(model!.relationships.every((r) => r.kind === 'fk')).toBe(true);

    const ids = new Set(model!.relationships.map((r) => r.id));
    for (const expected of [
      'rel:comments:c4', // comments.parent_id (self-loop)
      'rel:items:c4', // items.parent_id (self-loop)
      'rel:item_activity:c4', // item_activity.actor_id -> users.id
      'rel:item_values:c5', // item_values.value_user_id -> users.id
    ])
      expect(ids.has(expected)).toBe(true);
    // The reversed m2m rel ('fields.option_set_id -> option_sets.id') covered
    // this same pair under the old scheme; it must not also survive alongside
    // the derived edge (would inflate the count past 40 / collide in relById).
    expect(ids.has('e-option_sets.id->fields.option_set_id')).toBe(false);
    expect(model!.relById.size).toBe(40);
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

describe('loadModel — constraints and indexes', () => {
  it('synthesises constraints from legacy role/ref fields', () => {
    const raw = {
      groups: [{ id: 'z', label: 'Z' }],
      entities: [
        { id: 'users', group: 'z', fields: [{ name: 'id', type: 'serial', role: 'pk' }] },
        {
          id: 'orders',
          group: 'z',
          fields: [
            { name: 'id', type: 'serial', role: 'pk' },
            { name: 'user_id', type: 'int', role: 'fk', ref: 'users', refField: 'id' },
          ],
        },
      ],
    };
    const { model, errors } = loadModel(raw);
    expect(errors).toEqual([]);
    const orders = model!.entityById.get('orders')!;
    expect(orders.constraints).toEqual([
      { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
      {
        id: 'c2', kind: 'fk', name: null, columns: ['user_id'],
        refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null,
      },
    ]);
    expect(orders.indexes).toEqual([]);
    expect(orders.fields[1]!.nullable).toBe(true);
    expect(orders.fields[1]!.default).toBeNull();
  });

  it('treats a ref on a non-fk field as a foreign key (shared-pk reference)', () => {
    const raw = {
      groups: [{ id: 'z', label: 'Z' }],
      entities: [
        { id: 'events', group: 'z', fields: [{ name: 'id', type: 'bigserial', role: 'pk' }] },
        {
          id: 'outbox', group: 'z',
          fields: [{ name: 'event_id', type: 'bigint', role: 'pk', ref: 'events', refField: 'id' }],
        },
      ],
    };
    const outbox = loadModel(raw).model!.entityById.get('outbox')!;
    expect(outbox.constraints).toEqual([
      { id: 'c1', kind: 'pk', name: null, columns: ['event_id'] },
      {
        id: 'c2', kind: 'fk', name: null, columns: ['event_id'],
        refTable: 'events', refColumns: ['id'], onDelete: null, onUpdate: null,
      },
    ]);
  });

  it('reads explicit constraints, indexes, nullable and default verbatim', () => {
    const raw = {
      groups: [{ id: 'z', label: 'Z' }],
      entities: [
        { id: 'a', group: 'z', fields: [{ name: 'id', type: 'int' }] },
        {
          id: 'items', group: 'z',
          fields: [
            { name: 'id', type: 'bigserial', nullable: false },
            { name: 'a_id', type: 'int', nullable: false },
            { name: 'key', type: 'text', default: "'draft'" },
          ],
          constraints: [
            { id: 'c1', kind: 'pk', columns: ['id'] },
            { id: 'c2', kind: 'unique', name: 'items_a_key', columns: ['a_id', 'key'] },
            { id: 'c3', kind: 'fk', columns: ['a_id'], refTable: 'a', refColumns: ['id'], onDelete: 'cascade' },
            { id: 'c4', kind: 'check', expression: 'char_length(key) > 0' },
          ],
          indexes: [{ id: 'i1', name: 'idx_items_a', columns: ['a_id'], unique: false }],
        },
      ],
    };
    const { model, errors } = loadModel(raw);
    expect(errors).toEqual([]);
    const items = model!.entityById.get('items')!;
    expect(items.constraints).toHaveLength(4);
    expect(items.constraints[1]).toEqual({ id: 'c2', kind: 'unique', name: 'items_a_key', columns: ['a_id', 'key'] });
    expect(items.constraints[2]).toEqual({
      id: 'c3', kind: 'fk', name: null, columns: ['a_id'],
      refTable: 'a', refColumns: ['id'], onDelete: 'cascade', onUpdate: null,
    });
    expect(items.constraints[3]).toEqual({ id: 'c4', kind: 'check', name: null, expression: 'char_length(key) > 0' });
    expect(items.indexes).toEqual([{ id: 'i1', name: 'idx_items_a', columns: ['a_id'], unique: false }]);
    expect(items.fields[0]!.nullable).toBe(false);
    expect(items.fields[2]!.default).toBe("'draft'");
  });
});
