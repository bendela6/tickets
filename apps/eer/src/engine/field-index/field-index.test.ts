import { describe, expect, it } from 'vitest';

import { buildModel } from '../../test/models';
import { fieldIndex } from './field-index';

describe('fieldIndex', () => {
  const users = buildModel().entityById.get('users')!;

  it('returns the declaration row index of a field', () => {
    expect(fieldIndex(users, 'id')).toBe(0);
    expect(fieldIndex(users, 'name')).toBe(1);
    expect(fieldIndex(users, 'manager_id')).toBe(2);
  });

  it('returns -1 when the field does not exist', () => {
    expect(fieldIndex(users, 'nope')).toBe(-1);
  });
});
