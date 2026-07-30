import { describe, it, expect } from 'vitest';
import { searchModel } from './search-model';
import { buildModel, pkField } from '../../../test/models';

describe('searchModel', () => {
  it('matches entities and fields, caps at 20, empty query → []', () => {
    const model = buildModel();
    expect(searchModel(model, '')).toEqual([]);
    const users = searchModel(model, 'users');
    expect(users.some((m) => m.kind === 'entity' && m.entityId === 'users')).toBe(true);
    expect(searchModel(model, 'id').every((m) => m.search.includes('id'))).toBe(true);
    // cap: build a 25-entity model (reuse the big-model builder from the old eer-diagram test)
    const big = buildModel({
      groups: [{ id: 'g', label: 'G' }],
      entities: Array.from({ length: 25 }, (_, i) => ({ id: 'e' + i, group: 'g', fields: [pkField] })),
      relationships: [],
    });
    expect(searchModel(big, 'e').length).toBe(20);
  });
});
