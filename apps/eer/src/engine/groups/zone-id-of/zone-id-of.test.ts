import { describe, expect, it } from 'vitest';

import { buildModel, nestedRaw } from '../../../test/models';
import { zoneIdOf } from './zone-id-of';

describe('zoneIdOf', () => {
  const model = buildModel(nestedRaw());

  it('resolves a subgroup to its parent zone', () => {
    expect(zoneIdOf(model, 's')).toBe('z');
  });

  it('resolves a zone to itself', () => {
    expect(zoneIdOf(model, 'z')).toBe('z');
  });

  it('passes an unknown id through unchanged', () => {
    expect(zoneIdOf(model, 'ghost')).toBe('ghost');
  });
});
