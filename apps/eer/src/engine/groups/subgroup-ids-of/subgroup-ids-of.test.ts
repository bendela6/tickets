import { describe, expect, it } from 'vitest';

import { buildModel, nestedRaw } from '../../../test/models';
import { subgroupIdsOf } from './subgroup-ids-of';

describe('subgroupIdsOf', () => {
  const model = buildModel(nestedRaw());

  it('lists the direct child subgroups of a zone', () => {
    expect(subgroupIdsOf(model, 'z')).toEqual(['s']);
  });

  it('is empty for a subgroup (nesting is one level deep)', () => {
    expect(subgroupIdsOf(model, 's')).toEqual([]);
  });
});
