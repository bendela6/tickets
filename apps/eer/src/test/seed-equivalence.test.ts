// The seed was rewritten from legacy role/ref fields into constraints. This
// proves the rewrite changed the SHAPE and nothing else: the same edges, the
// same cardinalities, the same badges, the same titles.
import { describe, expect, it } from 'vitest';

import legacyRaw from './fixtures/items-platform.legacy.json';
import newRaw from '../../models/items-platform.json';
import { columnRoles } from '../engine/model/column-roles';
import { loadModel } from '../engine/model/load-model';

// `only` scopes the digest to a set of entity ids. The terminal/agent split
// added entirely new schemas (core.workdirs, terminal.*, agent.*) that the
// legacy fixture never had — this test proves the REWRITE of the pre-existing
// tables preserved their shape, so the new tables are out of its scope (their
// shape is guarded by model-conformance + the round-trip gate). Passing the
// legacy entity-id set keeps the comparison to the tables both sides share.
const digest = (raw: unknown, only?: Set<string>) => {
  const { model, errors } = loadModel(raw);
  expect(errors).toEqual([]);
  const m = model!;
  const keep = (id: string) => !only || only.has(id);
  return {
    entities: m.entities.map((e) => e.id).filter(keep).sort(),
    edges: m.relationships
      .filter((r) => keep(r.source) && keep(r.target))
      .map((r) => `${r.source}.${r.sourceField}->${r.target}.${r.targetField}:${r.cardinality}`)
      .sort(),
    labels: m.relationships.filter((r) => r.label && keep(r.source) && keep(r.target)).map((r) => r.label).sort(),
    titles: m.entities
      .filter((e) => keep(e.id))
      .flatMap((e) => e.columns.filter((c) => c.title).map((c) => `${e.id}.${c.name}=${c.title!}`))
      .sort(),
    badges: m.entities
      .filter((e) => keep(e.id))
      .flatMap((e) => {
        const roles = columnRoles(e);
        return e.columns.map((c) => `${e.id}.${c.name}:${roles.get(c.name)!.pk ? 'pk' : ''}${roles.get(c.name)!.fk ? 'fk' : ''}`);
      })
      .sort(),
  };
};

// The legacy fixture's entity set — the tables the equivalence check covers.
const legacyIds = new Set((legacyRaw as { entities: { id: string }[] }).entities.map((e) => e.id));

// The eer model moves past the legacy fixture in two intentional waves, both
// layered here so the assertion still catches any OTHER, unintended divergence.
//
// Task 1 (DDL enrichment): composite PKs on the three join tables
// (item_type_child_types, item_type_fields, link_type_target_types) now
// double as badges alongside their existing fk badge; options gets a new
// `kind` column; and a new events.caused_by self-FK (unlabelled) both adds an
// edge and — via item_activity's new UNIQUE(event_id) constraint — flips
// events.id->item_activity.event_id from 1-n to 1-1.
//
// SP3 (event runtime): the outbox worker gained retry bookkeeping — two new
// untyped columns outbox.attempts and outbox.last_error (titles "Attempts" /
// "Last error"), neither a pk or fk, so they add plain badges + titles only.
const applyTask1Deltas = (d: ReturnType<typeof digest>): ReturnType<typeof digest> => ({
  ...d,
  edges: d.edges
    .filter((e) => e !== 'events.id->item_activity.event_id:1-n')
    .concat(['events.id->events.caused_by:1-n', 'events.id->item_activity.event_id:1-1'])
    .sort(),
  titles: [...d.titles, 'options.kind=Kind', 'outbox.attempts=Attempts', 'outbox.last_error=Last error'].sort(),
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
      'outbox.attempts:',
      'outbox.last_error:',
    ])
    .sort(),
});

describe('seed rewrite', () => {
  it('the new seed is equivalent to the legacy one, plus the known Task 1 DDL-enrichment deltas: same edges, cardinalities, badges and titles otherwise', () => {
    expect(digest(newRaw, legacyIds)).toEqual(applyTask1Deltas(digest(legacyRaw)));
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
    // status is an option field, and options.kind carries its lifecycle. The
    // last five arrived with the terminal/agent split; they are compared
    // qualified because `session_status` is two different enums — one per
    // subsystem, each carrying only its own reachable states.
    expect(model!.enums.map((e) => (e.schema ? `${e.schema}.${e.name}` : e.name))).toEqual([
      'user_kind',
      'status_kind',
      'field_type',
      'core.runner_kind',
      'terminal.session_status',
      'agent.session_status',
      'agent.permission_mode',
      'agent.permission_status',
    ]);
  });
});
