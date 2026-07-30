import { describe, expect, it } from 'vitest';

import { buildModel, deepNestedRaw, nestedRaw } from '../../../test/models';
import { zoneIdOf } from './zone-id-of';

describe('zoneIdOf', () => {
  const model = buildModel(nestedRaw());

  it('resolves a subgroup to its parent zone', () => {
    expect(zoneIdOf(model, 's')).toBe('z');
  });

  it('resolves a zone to itself', () => {
    expect(zoneIdOf(model, 'z')).toBe('z');
  });

  it('walks all the way to the root through multiple levels (z → s → d)', () => {
    const deep = buildModel(deepNestedRaw());
    expect(zoneIdOf(deep, 'd')).toBe('z');
    expect(zoneIdOf(deep, 's')).toBe('z');
  });

  it('passes an unknown id through unchanged', () => {
    expect(zoneIdOf(model, 'ghost')).toBe('ghost');
  });
});
