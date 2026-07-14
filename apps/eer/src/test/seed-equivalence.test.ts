// The seed was rewritten from legacy role/ref fields into constraints. This
// proves the rewrite changed the SHAPE and nothing else: the same edges, the
// same cardinalities, the same badges, the same titles.
import { describe, expect, it } from 'vitest';

import legacyRaw from './fixtures/items-platform.legacy.json';
import newRaw from '../../models/items-platform.json';
import { columnRoles } from '../engine/model/column-roles';
import { loadModel } from '../engine/model/load-model';

const digest = (raw: unknown) => {
  const { model, errors } = loadModel(raw);
  expect(errors).toEqual([]);
  const m = model!;
  return {
    entities: m.entities.map((e) => e.id).sort(),
    edges: m.relationships
      .map((r) => `${r.source}.${r.sourceField}->${r.target}.${r.targetField}:${r.cardinality}`)
      .sort(),
    labels: m.relationships.filter((r) => r.label).map((r) => r.label).sort(),
    titles: m.entities.flatMap((e) => e.columns.filter((c) => c.title).map((c) => `${e.id}.${c.name}=${c.title!}`)).sort(),
    badges: m.entities
      .flatMap((e) => {
        const roles = columnRoles(e);
        return e.columns.map((c) => `${e.id}.${c.name}:${roles.get(c.name)!.pk ? 'pk' : ''}${roles.get(c.name)!.fk ? 'fk' : ''}`);
      })
      .sort(),
  };
};

// Task 1 (eer model DDL enrichment) intentionally moves the seed past the
// legacy fixture in three ways: composite PKs on the three join tables
// (item_type_child_types, item_type_fields, link_type_target_types) now
// double as badges alongside their existing fk badge; options gets a new
// `kind` column; and a new events.caused_by self-FK (unlabelled) both adds an
// edge and — via item_activity's new UNIQUE(event_id) constraint — flips
// events.id->item_activity.event_id from 1-n to 1-1. This layers exactly
// those known deltas onto the legacy digest before comparing, so the
// assertion still catches any OTHER, unintended divergence.
const applyTask1Deltas = (d: ReturnType<typeof digest>): ReturnType<typeof digest> => ({
  ...d,
  edges: d.edges
    .filter((e) => e !== 'events.id->item_activity.event_id:1-n')
    .concat(['events.id->events.caused_by:1-n', 'events.id->item_activity.event_id:1-1'])
    .sort(),
  titles: [...d.titles, 'options.kind=Kind'].sort(),
  badges: d.badges
    .filter(
      (b) =>
        ![
          'events.caused_by:',
          'item_type_child_types.child_type_id:fk',
          'item_type_child_types.parent_type_id:fk',
          'item_type_fields.field_id:fk',
          'item_type_fields.item_type_id:fk',
          'link_type_target_types.link_type_id:fk',
          'link_type_target_types.target_type_id:fk',
        ].includes(b),
    )
    .concat([
      'events.caused_by:fk',
      'item_type_child_types.child_type_id:pkfk',
      'item_type_child_types.parent_type_id:pkfk',
      'item_type_fields.field_id:pkfk',
      'item_type_fields.item_type_id:pkfk',
      'link_type_target_types.link_type_id:pkfk',
      'link_type_target_types.target_type_id:pkfk',
      'options.kind:',
    ])
    .sort(),
});

describe('seed rewrite', () => {
  it('the new seed is equivalent to the legacy one, plus the known Task 1 DDL-enrichment deltas: same edges, cardinalities, badges and titles otherwise', () => {
    expect(digest(newRaw)).toEqual(applyTask1Deltas(digest(legacyRaw)));
  });

  it('the seed has no unknown types and no bare "enum" columns', () => {
    const { model, warnings } = loadModel(newRaw);
    expect(warnings.filter((w) => /unknown type/.test(w))).toEqual([]);
    for (const e of model!.entities) {
      for (const c of e.columns) expect(c.type).not.toBe('enum');
    }
  });

  it('declares the enums its columns use', () => {
    const { model } = loadModel(newRaw);
    // status_kind arrived with the items-platform schema rebuild: a workflow
    // status is an option field, and options.kind carries its lifecycle.
    expect(model!.enums.map((e) => e.name)).toEqual(['user_kind', 'status_kind', 'field_type']);
  });
});
