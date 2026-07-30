import { describe, expect, it } from 'vitest';

import { portKey } from './port-key';

describe('portKey', () => {
  it('joins entity, field and side with pipes', () => {
    expect(portKey('users', 'id', 'R')).toBe('users|id|R');
  });

  it('yields distinct keys per side and per field', () => {
    expect(portKey('users', 'id', 'L')).not.toBe(portKey('users', 'id', 'R'));
    expect(portKey('users', 'id', 'L')).not.toBe(portKey('users', 'name', 'L'));
  });
});
