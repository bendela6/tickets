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
  it('roundtrips: loading the serialized form reproduces entities, fields, colors, layout and relationship ids', () => {
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
    // twoZoneRaw's fk-kind rels ('u-o', 't-o', 'self') carry hand-authored ids
    // that happen to coincide with a valid fk field — isFullyReDerivable's
    // id-scheme check means they serialize explicitly, so their ids must
    // survive the round trip unchanged too, not just their endpoint shape.
    expect(packed.relationships.map((r) => r.id).sort()).toEqual(m1.relationships.map((r) => r.id).sort());
  });

  it('keeps an fk-kind relationship whose id is not the derived scheme, and keeps other kinds too', () => {
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
    // 'a-b-fk' looks derivable in every OTHER respect (unlabelled, 1-n, backed by a
    // matching fk field) but its id ('a-b-fk') is not the derived scheme
    // ('e-a.id->b.a_id') — a hand-authored id, however plain-looking, is authored
    // data, so it must serialize explicitly rather than being silently dropped and
    // resurrected under a different id on the next load (see the dedicated
    // round-trip test below).
    expect((out.relationships as { id: string }[]).map((r) => r.id).sort()).toEqual(['a-b-fk', 'a-c-nm']);
  });

  it('omits an fk-kind relationship whose id IS the derived scheme', () => {
    const raw0 = {
      groups: [{ id: 'g', label: 'G', order: 0 }],
      entities: [
        { id: 'a', group: 'g', fields: [pkField] },
        { id: 'b', group: 'g', fields: [pkField, { name: 'a_id', type: 'int', role: 'fk', ref: 'a', refField: 'id' }] },
      ],
      relationships: [{ id: 'e-a.id->b.a_id', source: 'a', sourceField: 'id', target: 'b', targetField: 'a_id', kind: 'fk' }],
    };
    const m1 = buildModel(raw0);
    const out = serializeModel(m1, new Map());
    expect(out.relationships).toEqual([]);
  });

  // The exact shape the reviewer's finding hinges on: unlabelled, 1-n, kind 'fk',
  // backed by a matching fk field — everything isFullyReDerivable used to check —
  // but with a hand-authored id. Before the id-scheme check was added, this rel
  // was (wrongly) dropped from the saved file and came back on load re-derived
  // under 'e-a.id->b.a_id' instead of its real id: a silent rename, not just a
  // dropped-then-reappeared rel.
  it('a custom-id, unlabelled, 1-n fk-kind rel backed by a matching fk field survives serialize -> load with its id intact', () => {
    const raw0 = {
      groups: [{ id: 'g', label: 'G', order: 0 }],
      entities: [
        { id: 'a', group: 'g', fields: [pkField] },
        { id: 'b', group: 'g', fields: [pkField, { name: 'a_id', type: 'int', role: 'fk', ref: 'a', refField: 'id' }] },
      ],
      relationships: [{ id: 'owns-custom-id', source: 'a', sourceField: 'id', target: 'b', targetField: 'a_id', kind: 'fk' }],
    };
    const m1 = buildModel(raw0);
    const out = serializeModel(m1, new Map());
    expect((out.relationships as { id: string }[]).map((r) => r.id)).toEqual(['owns-custom-id']);

    const { model: m2, errors } = loadModel(out);
    expect(errors).toEqual([]);
    expect(m2!.relationships).toHaveLength(1);
    expect(m2!.relationships[0]!.id).toBe('owns-custom-id'); // not resurrected under the derived id
  });

  it('keeps a labelled fk-kind rel explicit even though a matching fk field exists', () => {
    const raw0 = {
      groups: [{ id: 'g', label: 'G', order: 0 }],
      entities: [
        { id: 'a', group: 'g', fields: [pkField] },
        { id: 'b', group: 'g', fields: [pkField, { name: 'a_id', type: 'int', role: 'fk', ref: 'a', refField: 'id' }] },
      ],
      relationships: [{ id: 'a-b-fk', source: 'a', sourceField: 'id', target: 'b', targetField: 'a_id', kind: 'fk', label: 'owns' }],
    };
    const m1 = buildModel(raw0);
    const out = serializeModel(m1, new Map());
    expect((out.relationships as { id: string; label?: string }[]).map((r) => r.id)).toEqual(['a-b-fk']);
    expect((out.relationships as { label?: string }[])[0]!.label).toBe('owns');
  });

  it('keeps an unlabelled fk-kind rel explicit when its cardinality is not the default 1-n', () => {
    const raw0 = {
      groups: [{ id: 'g', label: 'G', order: 0 }],
      entities: [
        { id: 'a', group: 'g', fields: [pkField] },
        { id: 'b', group: 'g', fields: [pkField, { name: 'a_id', type: 'int', role: 'fk', ref: 'a', refField: 'id' }] },
      ],
      // Hand-set to '1-1' (e.g. an identifying relationship) rather than the '1-n' a plain fk field would derive.
      relationships: [{ id: 'a-b-fk', source: 'a', sourceField: 'id', target: 'b', targetField: 'a_id', kind: 'fk', cardinality: '1-1' }],
    };
    const m1 = buildModel(raw0);
    const out = serializeModel(m1, new Map());
    expect((out.relationships as { id: string; cardinality: string }[]).map((r) => r.id)).toEqual(['a-b-fk']);
    expect((out.relationships as { cardinality: string }[])[0]!.cardinality).toBe('1-1');
  });

  it('keeps an unlabelled, 1-n fk-kind rel explicit when no matching fk-role field backs it', () => {
    const raw0 = {
      groups: [{ id: 'g', label: 'G', order: 0 }],
      entities: [
        { id: 'a', group: 'g', fields: [pkField] },
        // b.a_id is untagged (no role) — mirrors the real seed model's event-stream
        // reference (items.id -> events.aggregate_id), which is deliberately explicit.
        { id: 'b', group: 'g', fields: [pkField, { name: 'a_id', type: 'int' }] },
      ],
      relationships: [{ id: 'a-b-fk', source: 'a', sourceField: 'id', target: 'b', targetField: 'a_id', kind: 'fk' }],
    };
    const m1 = buildModel(raw0);
    const out = serializeModel(m1, new Map());
    expect((out.relationships as { id: string }[]).map((r) => r.id)).toEqual(['a-b-fk']);
  });

  // Rule: load seed -> no-op edit -> serialize -> load must reproduce the exact
  // same relationships (id, label, cardinality, kind), not just equivalent
  // endpoints — the whole point of preserving hand-authored fk-kind rels verbatim
  // instead of blowing them away and rederiving a label-less copy.
  it('roundtrips the real seed model byte-honestly: same id/label/cardinality/kind for every relationship after an edit + save + reload', () => {
    const { model: m1, errors: e1 } = loadModel(seedRaw);
    expect(e1).toEqual([]);

    const edited = applyModelEdit(m1!, { kind: 'setMeta', title: m1!.meta.title ?? '', description: m1!.meta.description ?? '' });
    const raw2 = serializeModel(edited, m1!.colors);
    const { model: m2, errors: e2 } = loadModel(raw2);
    expect(e2).toEqual([]);

    const relTuple = (r: Relationship) => [r.id, r.label, r.cardinality, r.kind] as const;
    const sortKey = (t: readonly [string, string | null, string, string | null]) => t[0];
    expect(m2!.relationships.map(relTuple).sort((a, b) => sortKey(a).localeCompare(sortKey(b)))).toEqual(
      m1!.relationships.map(relTuple).sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
    );

    const labelled = (rels: Relationship[]) => rels.filter((r) => r.label !== null).length;
    expect(labelled(m1!.relationships)).toBe(18);
    expect(labelled(m2!.relationships)).toBe(18);
  });
});
