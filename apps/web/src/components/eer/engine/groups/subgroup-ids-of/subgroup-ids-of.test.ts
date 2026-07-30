import { describe, expect, it } from 'vitest';

import { buildModel, deepNestedRaw, nestedRaw } from '../../../test/models';
import { subgroupIdsOf } from './subgroup-ids-of';

describe('subgroupIdsOf', () => {
  const model = buildModel(nestedRaw());

  it('lists the child subgroups of a zone', () => {
    expect(subgroupIdsOf(model, 'z')).toEqual(['s']);
  });

  it('is empty for a leaf group', () => {
    expect(subgroupIdsOf(model, 's')).toEqual([]);
  });

  it('gathers descendants transitively, at any depth (z → s → d)', () => {
    const deep = buildModel(deepNestedRaw());
    expect(new Set(subgroupIdsOf(deep, 'z'))).toEqual(new Set(['s', 'd']));
    expect(subgroupIdsOf(deep, 's')).toEqual(['d']);
    expect(subgroupIdsOf(deep, 'd')).toEqual([]);
  });
});
