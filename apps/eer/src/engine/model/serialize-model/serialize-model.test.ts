import { describe, expect, it } from 'vitest';

import { applyModelEdit } from '../apply-model-edit';
import { buildModel, pkField } from '../../../test/models';
import { loadModel } from '../load-model';
import { packLayout } from '../../layout/pack-layout';
import { serializeModel } from './serialize-model';
import type { Relationship } from '../types';
import seedRaw from '../../../../models/items-platform.json';

// Endpoint-tuple shape (source/sourceField/target/targetField/kind), independent
// of id/label/cardinality — a convenient equality key when two relationship
// lists should describe the same edges but aren't necessarily sorted the same
// way by id.
const tuple = (r: Pick<Relationship, 'source' | 'sourceField' | 'target' | 'targetField' | 'kind'>) =>
  `${r.source}.${r.sourceField}->${r.target}.${r.targetField}:${r.kind}`;

describe('serializeModel', () => {
  it('roundtrips: loading the serialized form reproduces entities, fields, colors, layout and the derived relationship set', () => {
    const m1 = buildModel();
    const colors = new Map([['z1', '#123456']]);
    const raw = serializeModel(m1, colors);
    const { model: m2, errors } = loadModel(raw);
    expect(errors).toEqual([]);
    const packed = packLayout(m2!);
    expect(packed.entities.map((e) => e.id)).toEqual(m1.entities.map((e) => e.id));
    expect(packed.entityById.get('orders')!.columns).toEqual(m1.entityById.get('orders')!.columns);
    expect(packed.colors.get('z1')).toBe('#123456');
    expect(packed.entityById.get('users')!.x).toBe(m1.entityById.get('users')!.x); // layout survived
    expect(packed.relationships.map(tuple).sort()).toEqual(m1.relationships.map(tuple).sort());
    // twoZoneRaw's rels are all kind:'fk' (derived from constraints) — their ids
    // ('rel:<entity>:<constraintId>') are fully determined by the entities'
    // constraints, so they must regenerate identically after a round trip too.
    expect(packed.relationships.map((r) => r.id).sort()).toEqual(m1.relationships.map((r) => r.id).sort());
  });

  it('never writes a kind:fk relationship to the file — it regenerates from its backing constraint on load', () => {
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
    // 'a-b-fk' never survived loadModel in the first place — it's superseded by
    // its derived twin (rel:b:c2) — so there is nothing kind:'fk' left to write.
    expect(m1.relationships.map((r) => r.kind).sort()).toEqual(['fk', 'nm']);
    const out = serializeModel(m1, new Map());
    expect((out.relationships as { id: string; kind?: string }[]).map((r) => r.kind ?? null)).toEqual(['nm']);
    expect((out.relationships as { id: string }[]).map((r) => r.id)).toEqual(['a-c-nm']);
  });

  it('an authored non-fk (n-m) relationship survives serialize -> load verbatim, including a custom id and label', () => {
    const raw0 = {
      groups: [{ id: 'g', label: 'G', order: 0 }],
      entities: [
        { id: 'a', group: 'g', fields: [pkField] },
        { id: 'b', group: 'g', fields: [pkField] },
      ],
      relationships: [
        {
          id: 'documented-link',
          source: 'a', sourceField: 'id', target: 'b', targetField: 'id',
          kind: 'nm', label: 'related to', cardinality: 'n-m',
        },
      ],
    };
    const m1 = buildModel(raw0);
    const out = serializeModel(m1, new Map());
    expect(out.relationships).toEqual([
      { id: 'documented-link', source: 'a', sourceField: 'id', target: 'b', targetField: 'id', kind: 'nm', label: 'related to', cardinality: 'n-m' },
    ]);

    const { model: m2, errors } = loadModel(out);
    expect(errors).toEqual([]);
    expect(m2!.relationships.some((r) => r.id === 'documented-link' && r.label === 'related to')).toBe(true);
  });

  it('emits an entity\'s constraints and indexes verbatim, omitting null names and null fk actions', () => {
    const raw0 = {
      groups: [{ id: 'g', label: 'G', order: 0 }],
      entities: [
        {
          id: 'a', group: 'g',
          fields: [
            { name: 'id', type: 'int' },
            { name: 'code', type: 'text', nullable: false, default: "'x'" },
          ],
          constraints: [
            { id: 'c1', kind: 'pk', columns: ['id'] },
            { id: 'c2', kind: 'unique', name: 'a_code_key', columns: ['code'] },
            { id: 'c3', kind: 'check', expression: "code <> ''" },
          ],
          indexes: [{ id: 'i1', name: 'idx_a_code', columns: ['code'], unique: false }],
        },
      ],
    };
    const { model: m1, errors } = loadModel(raw0);
    expect(errors).toEqual([]);
    const out = serializeModel(m1!, new Map());
    const entity = (out.entities as any[])[0];

    expect(entity.constraints).toEqual([
      { id: 'c1', kind: 'pk', columns: ['id'] },
      { id: 'c2', kind: 'unique', name: 'a_code_key', columns: ['code'] },
      { id: 'c3', kind: 'check', expression: "code <> ''" },
    ]);
    expect(entity.indexes).toEqual([{ id: 'i1', name: 'idx_a_code', columns: ['code'], unique: false }]);
    expect(entity.columns[0]).not.toHaveProperty('nullable'); // default nullable (true) is omitted
    expect(entity.columns[0]).not.toHaveProperty('default');
    expect(entity.columns[1]).toMatchObject({ nullable: false, default: "'x'" });
  });

  it('omits an fk constraint\'s null name/onDelete/onUpdate but keeps them when set', () => {
    const raw0 = {
      groups: [{ id: 'g', label: 'G', order: 0 }],
      entities: [
        { id: 'a', group: 'g', fields: [{ name: 'id', type: 'int' }], constraints: [{ id: 'c1', kind: 'pk', columns: ['id'] }] },
        {
          id: 'b', group: 'g',
          fields: [{ name: 'id', type: 'int' }, { name: 'a_id', type: 'int' }],
          constraints: [
            { id: 'c1', kind: 'pk', columns: ['id'] },
            { id: 'c2', kind: 'fk', columns: ['a_id'], refTable: 'a', refColumns: ['id'], onDelete: 'cascade' },
          ],
        },
      ],
    };
    const { model: m1, errors } = loadModel(raw0);
    expect(errors).toEqual([]);
    const out = serializeModel(m1!, new Map());
    const b = (out.entities as any[]).find((e) => e.id === 'b');
    expect(b.constraints).toEqual([
      { id: 'c1', kind: 'pk', columns: ['id'] },
      { id: 'c2', kind: 'fk', columns: ['a_id'], refTable: 'a', refColumns: ['id'], onDelete: 'cascade' },
    ]);
  });

  // Rule: load seed -> no-op edit -> serialize -> load must reproduce the exact
  // same derived edge set (same source/target/fields/id) and the same authored
  // labels — the whole point of deriving fk edges from constraints instead of
  // hand-copying a rel list around.
  //
  // CRITICAL, reviewer-found: a prior version dropped every authored kind:'fk'
  // relationship's label in favour of its bare derived twin, and serialize-
  // model then wrote ZERO relationships at all (every kind:'fk' rel was
  // treated as fully re-derivable, unconditionally) — so the first Save after
  // load erased all 17 backed labels and demoted all 3 m2m-kind edges to a
  // plain solid fk permanently. The assertions below are pinned to the ABSOLUTE
  // counts (not "m2 has as many labels as m1", which a naive fix could satisfy
  // vacuously at 0 === 0 if load dropped every label too).
  //
  // CRITICAL, reviewer-found (second bug): 'istream' carries a label too, but
  // it has NO backing fk constraint at all (items.events.aggregate_id is a
  // polymorphic reference, no `ref` on the field) — so it has no derived twin
  // to be folded onto. A prior version of deriveRelationships dropped any
  // authored relationship whose own kind read 'fk', unconditionally, once it
  // had no derived twin — silently erasing 'istream' (and its label) on
  // load, and serialize-model then had nothing left to write, so the very
  // next Save permanently erased the edge from the file. 18 (not 17) is the
  // correct label count; 'istream' must both load and round-trip.
  it('roundtrips the real seed model: same derived edge set, same labels/kinds, same titles after an edit + save + reload', () => {
    const { model: m1, errors: e1 } = loadModel(seedRaw);
    expect(e1).toEqual([]);

    const edited = applyModelEdit(m1!, { kind: 'setMeta', title: m1!.meta.title ?? '', description: m1!.meta.description ?? '' });
    const raw2 = serializeModel(edited, m1!.colors);
    const { model: m2, errors: e2 } = loadModel(raw2);
    expect(e2).toEqual([]);

    expect(m2!.relationships.map((r) => r.id).sort()).toEqual(m1!.relationships.map((r) => r.id).sort());
    expect(m2!.relationships.map(tuple).sort()).toEqual(m1!.relationships.map(tuple).sort());

    const labelled = (rels: Relationship[]) => rels.filter((r) => r.label !== null).length;
    expect(labelled(m1!.relationships)).toBe(18);
    expect(labelled(m2!.relationships)).toBe(18);
    const m2mKind = (rels: Relationship[]) => rels.filter((r) => r.kind === 'm2m').length;
    expect(m2mKind(m1!.relationships)).toBe(3);
    expect(m2mKind(m2!.relationships)).toBe(3);

    // 'istream' — unbacked, kept verbatim — must survive both load and the
    // save -> load round trip, id and label intact.
    expect(m1!.relById.get('istream')).toMatchObject({ label: 'stream', kind: 'fk' });
    expect(m2!.relById.get('istream')).toMatchObject({ label: 'stream', kind: 'fk' });

    expect(m2!.entities.map((e) => e.label).sort()).toEqual(m1!.entities.map((e) => e.label).sort());

    // A bare derived fk edge (no label, kind still 'fk', inferred cardinality,
    // and actually backed by a constraint) is never written — it regenerates
    // from its constraint. But 14 of the fk-kind edges carry a label the
    // constraint alone can't reproduce, so those ARE written (kind:'fk' — a
    // label doesn't change the kind), plus 'istream' (labelled, and has no
    // backing constraint to regenerate it from regardless), plus the 3
    // m2m-kind edges — 18 relationships written in total.
    const savedRels = raw2.relationships as { id: string; kind?: string; label?: string }[];
    expect(savedRels).toHaveLength(18);
    expect(savedRels.some((r) => r.id === 'istream' && r.label === 'stream')).toBe(true);
    const savedFk = savedRels.filter((r) => r.kind === 'fk');
    expect(savedFk).toHaveLength(15);
    expect(savedFk.every((r) => !!r.label)).toBe(true);
    expect(savedRels.filter((r) => r.kind === 'm2m')).toHaveLength(3);
  });

  // The task's second requirement, isolated: an authored `kind:'fk'`
  // relationship with NO label and no backing constraint must ALSO survive a
  // save -> load round trip. Its shape (kind 'fk', no label, an inferred —
  // not explicitly authored — cardinality) is indistinguishable from a bare
  // derived edge's by looking at the relationship alone; only checking
  // whether its endpoint pair is actually backed by a real fk constraint
  // (see `deriveConstraintEdges`) tells them apart. Omitting it on save would
  // erase it — there is no constraint left to regenerate it from.
  // CRITICAL, reviewer-found (round 2): a prior version wrote
  // `cardinality: r.cardinality` unconditionally, even when it was INFERRED
  // (never explicitly authored in the file). On reload, an explicit
  // `cardinality` key makes load-model set cardinalityInferred: false, and
  // derive-relationships then PINS that stale value over the freshly re-
  // derived one — one Save permanently freezes cardinality. Measured against
  // the real seed: 18 of 41 relationships flipped cardinalityInferred
  // true->false after a single roundtrip. The fix only writes `cardinality`
  // when cardinalityInferred is explicitly false (the file declared it).
  it('cardinalityInferred survives a save -> load roundtrip unchanged — no true->false flips', () => {
    const { model: m1, errors: e1 } = loadModel(seedRaw);
    expect(e1).toEqual([]);
    const inferredBefore = m1!.relationships.filter((r) => r.cardinalityInferred).length;
    expect(inferredBefore).toBeGreaterThan(0);

    const raw2 = serializeModel(m1!, m1!.colors);
    const { model: m2, errors: e2 } = loadModel(raw2);
    expect(e2).toEqual([]);
    const inferredAfter = m2!.relationships.filter((r) => r.cardinalityInferred).length;

    expect(inferredAfter).toBe(inferredBefore);
  });

  // Same bug, isolated to the concrete case the reviewer measured: adding a
  // UNIQUE constraint covering a labelled edge's fk column(s) must re-derive
  // that edge's cardinality to '1-1' — even after the model has already been
  // through one save/reload cycle. Before the fix, the first roundtrip
  // permanently pinned the edge at '1-n' and the UNIQUE constraint was
  // silently ignored by derivation.
  it('adding a UNIQUE constraint after a save/reload cycle still re-derives cardinality to 1-1 for a labelled edge', () => {
    const { model: m1, errors: e1 } = loadModel(seedRaw);
    expect(e1).toEqual([]);
    const raw2 = serializeModel(m1!, m1!.colors);
    const { model: m2, errors: e2 } = loadModel(raw2);
    expect(e2).toEqual([]);

    // schemes.id -> projects.scheme_id, labelled "scheme" — inferred 1-n
    // before the schema change.
    const before = m2!.relationships.find((r) => r.target === 'projects' && r.targetField === 'scheme_id')!;
    expect(before).toMatchObject({ label: 'scheme', cardinality: '1-n', cardinalityInferred: true });

    const projects = m2!.entityById.get('projects')!;
    const withUnique = applyModelEdit(m2!, {
      kind: 'upsertEntity',
      entity: {
        id: 'projects',
        label: projects.label,
        group: projects.group,
        description: projects.description,
        fields: projects.columns.map((f) => ({
          name: f.name,
          type: f.type,
          title: f.title,
          description: f.description,
          nullable: f.nullable,
          default: f.default,
          identity: f.identity,
          generated: f.generated,
        })),
        constraints: [...projects.constraints, { id: 'u1', kind: 'unique', name: null, columns: ['scheme_id'], nullsNotDistinct: false }],
        indexes: projects.indexes,
      },
    });

    const after = withUnique.relationships.find((r) => r.target === 'projects' && r.targetField === 'scheme_id')!;
    expect(after.cardinality).toBe('1-1');
    expect(after.label).toBe('scheme'); // label still donated correctly alongside the re-derived cardinality
  });

  // MINOR, reviewer-found (round 2): two authored rels on the same endpoint
  // pair used to lose the second one silently — only the first's label/kind
  // (the derived edge's one donor slot) survived, in memory and on save. The
  // fix keeps the second as its own relationship; this pins it through both a
  // plain load and a full save -> load roundtrip (the harder case: the
  // kept-verbatim second rel is written to the file BEFORE the enriched
  // derived edge, so re-reading it must not let it steal the donor slot back
  // by array order alone).
  it('two authored relationships on the same endpoint pair both survive load and a save -> load roundtrip', () => {
    const raw0 = {
      groups: [{ id: 'g', label: 'G', order: 0 }],
      kinds: [{ id: 'nm', label: 'Many-to-many', style: 'dashed' }],
      entities: [
        { id: 'a', group: 'g', fields: [pkField] },
        { id: 'b', group: 'g', fields: [pkField, { name: 'a_id', type: 'int', role: 'fk', ref: 'a', refField: 'id' }] },
      ],
      relationships: [
        { id: 'primary', source: 'a', sourceField: 'id', target: 'b', targetField: 'a_id', kind: 'fk', label: 'owner' },
        { id: 'secondary', source: 'a', sourceField: 'id', target: 'b', targetField: 'a_id', kind: 'nm', label: 'watcher' },
      ],
    };
    const { model: m1, errors: e1 } = loadModel(raw0);
    expect(e1).toEqual([]);
    expect(m1!.relationships).toHaveLength(2);
    expect(m1!.relById.get('rel:b:c2')).toMatchObject({ label: 'owner', kind: 'fk' });
    expect(m1!.relById.get('secondary')).toMatchObject({ label: 'watcher', kind: 'nm' });

    const raw2 = serializeModel(m1!, new Map());
    const { model: m2, errors: e2 } = loadModel(raw2);
    expect(e2).toEqual([]);
    expect(m2!.relationships).toHaveLength(2);
    expect(m2!.relById.get('rel:b:c2')).toMatchObject({ label: 'owner', kind: 'fk' });
    expect(m2!.relById.get('secondary')).toMatchObject({ label: 'watcher', kind: 'nm' });
  });

  it('an authored fk-kind relationship with no label and no backing constraint survives a save -> load round trip', () => {
    const raw0 = {
      groups: [{ id: 'g', label: 'G', order: 0 }],
      entities: [
        { id: 'items', group: 'g', fields: [pkField] },
        {
          id: 'events', group: 'g',
          fields: [pkField, { name: 'aggregate_id', type: 'int' }], // no ref: polymorphic
        },
      ],
      relationships: [
        { id: 'poly', source: 'items', sourceField: 'id', target: 'events', targetField: 'aggregate_id', kind: 'fk' },
      ],
    };
    const { model: m1, errors: e1 } = loadModel(raw0);
    expect(e1).toEqual([]);
    expect(m1!.relById.get('poly')).toMatchObject({ kind: 'fk', label: null });

    const out = serializeModel(m1!, new Map());
    expect((out.relationships as { id: string }[]).some((r) => r.id === 'poly')).toBe(true);

    const { model: m2, errors: e2 } = loadModel(out);
    expect(e2).toEqual([]);
    expect(m2!.relById.get('poly')).toMatchObject({ kind: 'fk', label: null });
  });

  it('round-trips every new field through save → load', () => {
    const raw = {
      meta: { title: 'x' },
      enums: [{ name: 'k', values: ['a', 'b'], schema: null }],
      groups: [{ id: 'g', label: 'G' }],
      entities: [
        {
          id: 't', label: 't', group: 'g', schema: null,
          columns: [
            { name: 'id', type: 'serial' },
            { name: 'k', type: 'k' },
            { name: 'tags', type: 'text[]' },
          ],
          constraints: [
            { id: 'c1', kind: 'pk', columns: ['id'] },
            { id: 'c2', kind: 'unique', columns: ['k'], nullsNotDistinct: true },
          ],
          indexes: [
            {
              id: 'i1', name: 'idx', unique: false, method: 'gin', only: false, where: 'k IS NOT NULL',
              columns: [{ expression: 'lower(k)', isExpression: true, order: 'asc', nulls: 'first', opClass: null }],
            },
          ],
        },
      ],
    };
    const first = loadModel(raw).model!;
    const second = loadModel(JSON.parse(JSON.stringify(serializeModel(first, new Map())))).model!;
    expect(second.entities[0]!.indexes).toEqual(first.entities[0]!.indexes);
    expect(second.entities[0]!.constraints).toEqual(first.entities[0]!.constraints);
    expect(second.enums).toEqual(first.enums);
  });
});
