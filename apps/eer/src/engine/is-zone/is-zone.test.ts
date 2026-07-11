import { describe, expect, it } from 'vitest';

import { buildModel, nestedRaw } from '../../test/models';
import { isZone } from './is-zone';

describe('isZone', () => {
  const model = buildModel(nestedRaw());

  it('is true for a top-level zone', () => {
    expect(isZone(model, 'z')).toBe(true);
  });

  it('is false for a subgroup', () => {
    expect(isZone(model, 's')).toBe(false);
  });

  it('counts an unknown id as a zone', () => {
    expect(isZone(model, 'ghost')).toBe(true);
  });
});
