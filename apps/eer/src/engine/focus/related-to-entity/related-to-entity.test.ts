import { describe, it, expect } from 'vitest';
import { buildModel } from '../../../test/models';
import { relatedToEntity } from './related-to-entity';

describe('relatedToEntity', () => {
  it('entity + neighbours + their edges', () => {
    const model = buildModel();
    const r = relatedToEntity(model, 'users');
    expect(r.entities).toEqual(new Set(['users', 'orders']));
    expect(r.edges).toEqual(new Set(['u-o', 'self']));
  });
});
