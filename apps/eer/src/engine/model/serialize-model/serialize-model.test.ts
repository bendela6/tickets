import { describe, expect, it } from 'vitest';

import { applyModelEdit } from '../apply-model-edit';
import { buildModel, pkField } from '../../../test/models';
import { loadModel } from '../load-model';
import { packLayout } from '../../layout/pack-layout';
import { serializeModel } from './serialize-model';
import type { Relationship } from '../types';
import seedRaw from '../../../../models/items-platform.json';

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
