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
    expect(packed.entityById.get('orders')!.fields).toEqual(m1.entityById.get('orders')!.fields);
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
    expect(entity.fields[0]).not.toHaveProperty('nullable'); // default nullable (true) is omitted
    expect(entity.fields[0]).not.toHaveProperty('default');
    expect(entity.fields[1]).toMatchObject({ nullable: false, default: "'x'" });
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
    expect(labelled(m1!.relationships)).toBe(17);
    expect(labelled(m2!.relationships)).toBe(17);
    const m2mKind = (rels: Relationship[]) => rels.filter((r) => r.kind === 'm2m').length;
    expect(m2mKind(m1!.relationships)).toBe(3);
    expect(m2mKind(m2!.relationships)).toBe(3);

    expect(m2!.entities.map((e) => e.label).sort()).toEqual(m1!.entities.map((e) => e.label).sort());

    // A bare derived fk edge (no label, kind still 'fk', inferred cardinality)
    // is never written — it regenerates from its constraint. But 14 of the
    // fk-kind edges carry a label the constraint alone can't reproduce, so
    // those ARE written (kind:'fk' — a label doesn't change the kind), plus
    // the 3 m2m-kind edges — 17 relationships written in total.
    const savedRels = raw2.relationships as { kind?: string; label?: string }[];
    expect(savedRels).toHaveLength(17);
    const savedFk = savedRels.filter((r) => r.kind === 'fk');
    expect(savedFk).toHaveLength(14);
    expect(savedFk.every((r) => !!r.label)).toBe(true);
    expect(savedRels.filter((r) => r.kind === 'm2m')).toHaveLength(3);
  });
});
