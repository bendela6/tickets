import { describe, it, expect } from 'vitest';
import { buildModel, nestedRaw } from '../../../test/models';
import { relatedToGroup } from './related-to-group';

describe('relatedToGroup', () => {
  it('zone members, their partners, edges, and lit boxes incl subgroups', () => {
    const model = buildModel(nestedRaw());
    const r = relatedToGroup(model, 'z');
    expect(r.entities).toEqual(new Set(['loose', 'm1', 'm2']));
    expect(r.edges).toEqual(new Set(['m1-m2']));
    expect(r.litGroups).toEqual(new Set(['z', 's']));
  });
});
