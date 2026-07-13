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

describe('seed rewrite', () => {
  it('the new seed is equivalent to the legacy one: same edges, cardinalities, badges and titles', () => {
    expect(digest(newRaw)).toEqual(digest(legacyRaw));
  });
});
