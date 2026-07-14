import { describe, expect, it } from 'vitest';

import { endKinds } from './end-kinds';

describe('endKinds', () => {
  it('maps 1-n to [one, many]', () => {
    expect(endKinds('1-n')).toEqual(['one', 'many']);
  });

  it('maps n-1 to [many, one]', () => {
    expect(endKinds('n-1')).toEqual(['many', 'one']);
  });

  it('maps n-m to [many, many]', () => {
    expect(endKinds('n-m')).toEqual(['many', 'many']);
  });

  it('maps 1-1 and anything unrecognized to [one, one]', () => {
    expect(endKinds('1-1')).toEqual(['one', 'one']);
    expect(endKinds('bogus')).toEqual(['one', 'one']);
    expect(endKinds('')).toEqual(['one', 'one']);
  });
});
