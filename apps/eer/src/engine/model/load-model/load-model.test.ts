import { describe, expect, it } from 'vitest';

import { columnRoles } from '../column-roles';
import { loadModel } from './load-model';
import { serializeModel } from '../serialize-model';
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

// These pin the fix that made cardinality inference read the endpoints'
// derived CONSTRAINT roles (columnRoles: pk/fk booleans) instead of the
// legacy per-field `role` key. A constraints-authored file (an explicit
// `constraints` array, no `role`/`ref` anywhere) has no legacy roles at all —
// before the fix, every authored relationship without an explicit
// `cardinality` fell into the "ambiguous" fallback (1-n + a warning),
// regardless of what its constraints actually said.
describe('loadModel — cardinality inferred from CONSTRAINTS, not legacy roles', () => {
  it('(a) infers 1-n from a pk/fk constraint pair — no legacy role/ref key anywhere in the file', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        {
          id: 'users', group: 'g',
          fields: [{ name: 'id', type: 'serial' }],
          constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }],
        },
        {
          id: 'orders', group: 'g',
          fields: [{ name: 'id', type: 'serial' }, { name: 'user_id', type: 'int' }],
          constraints: [
            { id: 'c1', kind: 'pk', columns: ['id'] },
            { id: 'c2', kind: 'fk', columns: ['user_id'], refTable: 'users', refColumns: ['id'] },
          ],
        },
      ],
      relationships: [{ id: 'r1', source: 'users', sourceField: 'id', target: 'orders', targetField: 'user_id' }],
    };
    const { model, errors, warnings } = loadModel(raw);
    expect(errors).toEqual([]);
    // The pair is also backed by a real fk constraint, so its final
    // cardinality would read 1-n from derive-relationships' own
    // cardinalityOf() regardless — the warning is the honest signal that
    // inferCardinality itself resolved this from constraints rather than
    // hitting the ambiguous fallback (which is what happens today, since
    // there's no legacy `role` key anywhere for the old code to read).
    expect(warnings).toEqual([]);
    const rel = model!.relationships.find((r) => r.source === 'users' && r.target === 'orders')!;
    expect(rel.cardinality).toBe('1-n');
  });

  it('(b) infers n-m for an fk<->fk pair with no shared backing constraint — the m2m case the seed relies on', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        { id: 'a', group: 'g', fields: [{ name: 'id', type: 'serial' }], constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }] },
        { id: 'b', group: 'g', fields: [{ name: 'id', type: 'serial' }], constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }] },
        {
          id: 'junction', group: 'g',
          fields: [{ name: 'a_id', type: 'int' }, { name: 'b_id', type: 'int' }],
          constraints: [
            { id: 'c1', kind: 'fk', columns: ['a_id'], refTable: 'a', refColumns: ['id'] },
            { id: 'c2', kind: 'fk', columns: ['b_id'], refTable: 'b', refColumns: ['id'] },
          ],
        },
      ],
      // junction.a_id <-> junction.b_id: neither column is anyone's pk, and no
      // single fk constraint links them to EACH OTHER (each's fk constraint
      // points at a/b respectively) — so this edge isn't covered by any
      // derived pair and survives verbatim, cardinality straight from
      // inferCardinality (not masked by derive-relationships).
      relationships: [
        { id: 'm2m-edge', source: 'junction', sourceField: 'a_id', target: 'junction', targetField: 'b_id', kind: 'm2m', label: 'M2M' },
      ],
    };
    const { model, errors, warnings } = loadModel(raw);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(model!.relById.get('m2m-edge')!.cardinality).toBe('n-m');
  });

  it('(c) infers 1-1 for a pk<->pk pair (identifying / shared key) with no backing fk constraint', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        { id: 'events', group: 'g', fields: [{ name: 'id', type: 'bigserial' }], constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }] },
        // 'audit' shares events' key (an identifying relationship) but no fk
        // constraint is modelled at all — keeps this edge unbacked, so the
        // value comes straight from inferCardinality rather than being masked
        // by derive-relationships' own cardinalityOf.
        { id: 'audit', group: 'g', fields: [{ name: 'event_id', type: 'bigint' }], constraints: [{ id: 'c1', kind: 'pk', columns: ['event_id'] }] },
      ],
      relationships: [{ id: 'e-audit', source: 'events', sourceField: 'id', target: 'audit', targetField: 'event_id' }],
    };
    const { model, errors, warnings } = loadModel(raw);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(model!.relById.get('e-audit')!.cardinality).toBe('1-1');
  });
});

// Closes the schema seam: the file format's entity key was renamed
// `fields` -> `columns` (matching the model's Entity.columns), but load-model
// used to only recognise `fields` — so a model authored NATURALLY in the new
// shape (columns + constraints, no `fields` anywhere) tripped the confusing
// "has no fields" error. `columns` is now the canonical key; `fields` is kept
// forever as a legacy alias so every pre-rewrite file keeps loading unchanged.
describe('loadModel — "columns" is canonical, "fields" is a permanent legacy alias', () => {
  it('a NEW-shape entity (columns + constraints, no "fields" key anywhere) loads with 0 errors and derives the right edges/badges', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        {
          id: 'users', group: 'g',
          columns: [{ name: 'id', type: 'serial' }],
          constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }],
        },
        {
          id: 'orders', group: 'g',
          columns: [{ name: 'id', type: 'serial' }, { name: 'user_id', type: 'int' }],
          constraints: [
            { id: 'c1', kind: 'pk', columns: ['id'] },
            { id: 'c2', kind: 'fk', columns: ['user_id'], refTable: 'users', refColumns: ['id'] },
          ],
        },
      ],
      relationships: [],
    };
    const { model, errors, warnings } = loadModel(raw);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(model!.relationships).toHaveLength(1);
    expect(model!.relationships[0]).toMatchObject({
      source: 'users', sourceField: 'id', target: 'orders', targetField: 'user_id',
      kind: 'fk', cardinality: '1-n',
    });
    expect(columnRoles(model!.entityById.get('users')!).get('id')).toMatchObject({ pk: true });
    expect(columnRoles(model!.entityById.get('orders')!).get('user_id')).toMatchObject({ fk: true });
  });

  it('an entity with no "columns" (and no "fields") is rejected with the new wording', () => {
    const { errors } = loadModel({
      groups: [{ id: 'g', label: 'G' }],
      entities: [{ id: 'a', group: 'g', columns: [] }],
    });
    expect(errors).toContain('Entity "a" has no columns.');
  });

  it('when a file carries both keys, "columns" wins over the legacy "fields"', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [{ id: 'a', group: 'g', columns: [{ name: 'real', type: 'int' }], fields: [{ name: 'stale', type: 'int' }] }],
    };
    const { model, errors } = loadModel(raw);
    expect(errors).toEqual([]);
    expect(model!.entityById.get('a')!.columns.map((c) => c.name)).toEqual(['real']);
  });

  // The other half of the seam: back-compat is a hard requirement, so a file
  // still authored in the pre-rewrite shape (`fields` + per-field
  // `role`/`ref`/`refField`, no `constraints` array at all) must keep loading
  // exactly as before — synthesising its pk/fk constraints and deriving the
  // same edges.
  it('legacy alias: a "fields" + role/ref-authored entity still loads, synthesising constraints and deriving edges', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        { id: 'users', group: 'g', fields: [{ name: 'id', type: 'serial', role: 'pk' }] },
        {
          id: 'orders', group: 'g',
          fields: [
            { name: 'id', type: 'serial', role: 'pk' },
            { name: 'user_id', type: 'int', role: 'fk', ref: 'users', refField: 'id' },
          ],
        },
      ],
      relationships: [],
    };
    const { model, errors, warnings } = loadModel(raw);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(model!.entityById.get('orders')!.constraints).toEqual([
      { id: 'c1', kind: 'pk', name: null, columns: ['id'] },
      {
        id: 'c2', kind: 'fk', name: null, columns: ['user_id'], refSchema: null,
        refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null,
      },
    ]);
    expect(model!.relationships).toHaveLength(1);
    expect(model!.relationships[0]).toMatchObject({
      source: 'users', sourceField: 'id', target: 'orders', targetField: 'user_id',
      kind: 'fk', cardinality: '1-n',
    });
  });
});

// Regression guard for the real bundled seed (now rewritten into the
// canonical `columns` + `constraints` shape). The fix must not change a
// single value here — pinning the exact multiset makes any future regression
// visible instead of silently averaging out.
describe('loadModel — real seed regression (pinned cardinality multiset)', () => {
  // Task 9 rewrote the seed onto real drizzle-canonical types (and declared
  // `enums` for the two columns that used to spell the placeholder "enum") —
  // 0 warnings is now the bar, same as every other warning-affecting
  // behaviour.

  it('(d) loads with 0 errors, 0 warnings, 41 relationships, 18 labels, 3 m2m, and this exact cardinality multiset', () => {
    const { model, errors, warnings } = loadModel(seedRaw);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(model!.relationships).toHaveLength(41);
    expect(model!.relationships.filter((r) => r.label)).toHaveLength(18);
    expect(model!.relationships.filter((r) => r.kind === 'm2m')).toHaveLength(3);

    const counts: Record<string, number> = {};
    for (const r of model!.relationships) counts[r.cardinality] = (counts[r.cardinality] ?? 0) + 1;
    expect(counts).toEqual({ '1-n': 40, '1-1': 1 });
  });

  // T9: serializeModel never writes legacy `role`/`ref` (only `constraints`),
  // so serialize -> reload produces the constraints-only (now also
  // `columns`-keyed) shape the seed itself has been rewritten into. Before the
  // fix, every entity's fields lose their legacy role on the second load, so
  // every authored relationship
  // without an explicit cardinality trips the ambiguous fallback and warns —
  // even though most VALUES happen to come out unchanged anyway (masked by
  // derive-relationships' own cardinalityOf override for constraint-backed
  // pairs). 0 warnings is the bar; equal-by-id cardinality is the belt.
  it('(e) serialize -> reload (constraints-only shape) yields the SAME cardinality per relationship, with 0 warnings', () => {
    const { model: m1, errors: e1, warnings: w1 } = loadModel(seedRaw);
    expect(e1).toEqual([]);
    expect(w1).toEqual([]);

    const raw2 = serializeModel(m1!, m1!.colors);
    const { model: m2, errors: e2, warnings: w2 } = loadModel(raw2);
    expect(e2).toEqual([]);
    expect(w2).toEqual([]);

    const byId = (rels: { id: string; cardinality: string }[]) => new Map(rels.map((r) => [r.id, r.cardinality]));
    expect(byId(m2!.relationships)).toEqual(byId(m1!.relationships));
  });
});

// IMPORTANT, whole-branch review: the canonical `constraints` shape used to
// validate WEAKER than the legacy `fields` role/ref shape it replaced —
// normalizeConstraint never checked that an fk's refTable resolved, or that
// its columns/refColumns actually existed on the respective tables. That
// asymmetry is exactly why a file corrupted by apply-model-edit missing an
// inbound-fk guard (see apply-model-edit.test.ts) could load clean: 0 errors,
// 0 warnings. These pin the fix — a WARNING (the file still loads, matching
// the legacy behaviour), not an error, for each of the three ways a
// constraints-shaped fk can dangle.
describe('loadModel — dangling fk CONSTRAINTS warn (canonical shape, not just legacy ref)', () => {
  it('(i) an fk to an unknown table warns and produces no phantom edge', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        {
          id: 'b', group: 'g',
          fields: [{ name: 'id', type: 'int' }, { name: 'a_id', type: 'int' }],
          constraints: [
            { id: 'pk1', kind: 'pk', columns: ['id'] },
            { id: 'fk1', kind: 'fk', columns: ['a_id'], refTable: 'ghost', refColumns: ['id'] },
          ],
        },
      ],
    };
    const { model, errors, warnings } = loadModel(raw);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('"b"') && w.includes('"fk1"') && w.includes('unknown table "ghost"'))).toBe(true);
    expect(model!.relationships).toEqual([]);
  });

  it('(ii) an fk to an unknown column on a real target table warns and produces no phantom edge', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        { id: 'a', group: 'g', fields: [{ name: 'id', type: 'int' }], constraints: [{ id: 'pk1', kind: 'pk', columns: ['id'] }] },
        {
          id: 'b', group: 'g',
          fields: [{ name: 'id', type: 'int' }, { name: 'a_id', type: 'int' }],
          constraints: [
            { id: 'pk2', kind: 'pk', columns: ['id'] },
            { id: 'fk1', kind: 'fk', columns: ['a_id'], refTable: 'a', refColumns: ['nope'] },
          ],
        },
      ],
    };
    const { model, errors, warnings } = loadModel(raw);
    expect(errors).toEqual([]);
    expect(
      warnings.some((w) => w.includes('"b"') && w.includes('"fk1"') && w.includes('unknown column "nope" on table "a"')),
    ).toBe(true);
    expect(model!.relationships).toEqual([]);
  });

  it('(iii) an fk naming an unknown OWN column warns and produces no phantom edge', () => {
    const raw = {
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        { id: 'a', group: 'g', fields: [{ name: 'id', type: 'int' }], constraints: [{ id: 'pk1', kind: 'pk', columns: ['id'] }] },
        {
          id: 'b', group: 'g',
          fields: [{ name: 'id', type: 'int' }],
          constraints: [
            { id: 'pk2', kind: 'pk', columns: ['id'] },
            { id: 'fk1', kind: 'fk', columns: ['nope'], refTable: 'a', refColumns: ['id'] },
          ],
        },
      ],
    };
    const { model, errors, warnings } = loadModel(raw);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('"b"') && w.includes('"fk1"') && w.includes('unknown own column "nope"'))).toBe(true);
    expect(model!.relationships).toEqual([]);
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
  // constraint now derives its own edge — including the 3 that are hand-
  // authored as kind:'m2m' (all 3 of the seed's m2m rels cover a pair a real
  // fk field also covers). The derived edge's id/shape always wins over its
  // authored twin — no separate 'e-...' authored entry survives alongside it
  // — but the authored data merges ONTO the derived edge rather than being
  // discarded: those 3 keep their 'm2m' kind (rendered dashed) instead of
  // being flattened to a plain solid 'fk' (see derive-relationships.ts).
  // 39 constraints - 0 unresolvable = 40 (item_type_fields also carries a
  // composite-looking pair via two separate single-column fk fields, each
  // deriving its own edge), plus 1 authored `kind:'fk'` relationship with NO
  // backing constraint at all ('istream' — items.events.aggregate_id is a
  // polymorphic reference, no `ref` on the field) kept verbatim rather than
  // dropped just because its kind reads 'fk' — 41 total.
  it('derives exactly one edge per fk constraint for the real seed model (41; 3 keep their authored m2m kind, 1 is an unbacked authored fk kept verbatim)', () => {
    const { model, errors } = loadModel(seedRaw);
    expect(errors).toEqual([]);
    expect(model!.relationships).toHaveLength(41);
    expect(model!.relationships.filter((r) => r.kind === 'fk')).toHaveLength(38);
    expect(model!.relationships.filter((r) => r.kind === 'm2m')).toHaveLength(3);
    expect(model!.relById.get('istream')).toMatchObject({ label: 'stream', kind: 'fk' });

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
    // the derived edge (would inflate the count past 41 / collide in relById).
    expect(ids.has('e-option_sets.id->fields.option_set_id')).toBe(false);
    expect(model!.relById.size).toBe(41);
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
        id: 'c2', kind: 'fk', name: null, columns: ['user_id'], refSchema: null,
        refTable: 'users', refColumns: ['id'], onDelete: null, onUpdate: null,
      },
    ]);
    expect(orders.indexes).toEqual([]);
    expect(orders.columns[1]!.nullable).toBe(true);
    expect(orders.columns[1]!.default).toBeNull();
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
        id: 'c2', kind: 'fk', name: null, columns: ['event_id'], refSchema: null,
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
    expect(items.constraints[1]).toEqual({ id: 'c2', kind: 'unique', name: 'items_a_key', columns: ['a_id', 'key'], nullsNotDistinct: false });
    expect(items.constraints[2]).toEqual({
      id: 'c3', kind: 'fk', name: null, columns: ['a_id'], refSchema: null,
      refTable: 'a', refColumns: ['id'], onDelete: 'cascade', onUpdate: null,
    });
    expect(items.constraints[3]).toEqual({ id: 'c4', kind: 'check', name: null, expression: 'char_length(key) > 0' });
    expect(items.indexes).toEqual([
      {
        id: 'i1', name: 'idx_items_a', unique: false, method: null, only: false, where: null,
        columns: [{ expression: 'a_id', isExpression: false, order: null, nulls: null, opClass: null }],
      },
    ]);
    expect(items.columns[0]!.nullable).toBe(false);
    expect(items.columns[2]!.default).toBe("'draft'");
  });
});

describe('drizzle-shaped model', () => {
  const base = {
    groups: [{ id: 'g', label: 'G' }],
    entities: [
      {
        id: 't', label: 't', group: 'g',
        columns: [{ name: 'id', type: 'int' }, { name: 'body', type: 'text' }],
        constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }],
      },
    ],
  };

  it('normalises legacy index columns from string[] to IndexColumn[]', () => {
    const { model } = loadModel({
      ...base,
      entities: [{ ...base.entities[0], indexes: [{ id: 'i1', name: 'idx', columns: ['body'], unique: false }] }],
    });
    expect(model!.entities[0]!.indexes[0]!.columns).toEqual([
      { expression: 'body', isExpression: false, order: null, nulls: null, opClass: null },
    ]);
  });

  it('keeps a full index column with ordering, opClass, method, only and where', () => {
    const { model } = loadModel({
      ...base,
      entities: [
        {
          ...base.entities[0],
          indexes: [
            {
              id: 'i1', name: 'idx', unique: true, method: 'btree', only: false,
              where: "body <> ''",
              columns: [{ expression: 'body', isExpression: false, order: 'desc', nulls: 'last', opClass: 'text_ops' }],
            },
          ],
        },
      ],
    });
    const ix = model!.entities[0]!.indexes[0]!;
    expect(ix.method).toBe('btree');
    expect(ix.where).toBe("body <> ''");
    expect(ix.only).toBe(false);
    expect(ix.columns[0]).toEqual({ expression: 'body', isExpression: false, order: 'desc', nulls: 'last', opClass: 'text_ops' });
  });

  it('normalises legacy type aliases onto drizzle-canonical names', () => {
    const { model } = loadModel(base);
    expect(model!.entities[0]!.columns[0]!.type).toBe('integer'); // was "int"
  });

  it('warns on an unknown type but keeps the text verbatim', () => {
    const { model, warnings } = loadModel({
      ...base,
      entities: [{ ...base.entities[0], columns: [{ name: 'id', type: 'legacy_money' }] }],
    });
    expect(model!.entities[0]!.columns[0]!.type).toBe('legacy_money');
    expect(warnings.join(' ')).toContain('legacy_money');
  });

  it('does not warn on a type declared as a model enum', () => {
    const { warnings } = loadModel({
      ...base,
      enums: [{ name: 'user_kind', values: ['human', 'agent'] }],
      entities: [{ ...base.entities[0], columns: [{ name: 'id', type: 'user_kind' }] }],
    });
    expect(warnings.join(' ')).not.toContain('user_kind');
  });

  it('loads enums, nullsNotDistinct, refSchema, identity, generated and entity schema', () => {
    const { model } = loadModel({
      ...base,
      enums: [{ name: 'k', values: ['a', 'b'], schema: null }],
      entities: [
        {
          id: 't', label: 't', group: 'g', schema: 'billing',
          columns: [
            { name: 'id', type: 'integer', identity: { always: true } },
            { name: 'total', type: 'integer', generated: { expression: 'qty * price', stored: true } },
          ],
          constraints: [
            { id: 'c1', kind: 'unique', columns: ['id'], nullsNotDistinct: true },
            { id: 'c2', kind: 'fk', columns: ['id'], refSchema: 'public', refTable: 't', refColumns: ['id'] },
          ],
        },
      ],
    });
    const e = model!.entities[0]!;
    expect(model!.enums).toEqual([{ name: 'k', values: ['a', 'b'], schema: null }]);
    expect(e.schema).toBe('billing');
    expect(e.columns[0]!.identity!.always).toBe(true);
    expect(e.columns[1]!.generated).toEqual({ expression: 'qty * price', stored: true });
    expect(e.constraints[0]).toMatchObject({ kind: 'unique', nullsNotDistinct: true });
    expect(e.constraints[1]).toMatchObject({ kind: 'fk', refSchema: 'public' });
  });
});
