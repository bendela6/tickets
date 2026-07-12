import { describe, it, expect } from 'vitest';
import { buildModel } from '../../../test/models';
import { fieldEdges } from './field-edges';

describe('fieldEdges', () => {
  it('edges touching one field on either end', () => {
    const model = buildModel();
    expect(fieldEdges(model, 'users', 'id')).toEqual(new Set(['u-o', 'self']));
    expect(fieldEdges(model, 'users', 'name').size).toBe(0);
  });
});
