import { describe, it, expect } from 'vitest';
import { buildModel, nestedRaw } from '../../../test/models';
import { relatedToGroup } from './related-to-group';

describe('relatedToGroup', () => {
  it('zone members, their partners, edges, and lit boxes incl subgroups', () => {
    const model = buildModel(nestedRaw());
    const r = relatedToGroup(model, 'z');
    expect(r.entities).toEqual(new Set(['loose', 'm1', 'm2']));
    // nestedRaw's explicit 'm1-m2' rel covers the same pair as m2's fk field
    // (m1_id -> m1.id) — the derived edge wins, under a new id (see
    // derive-relationships.ts).
    expect(r.edges).toEqual(new Set(['rel:m2:c2']));
    expect(r.litGroups).toEqual(new Set(['z', 's']));
  });
});
