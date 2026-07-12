import { describe, expect, it } from 'vitest';

import { buildModel } from '../../../test/models';
import { GROUP_PALETTE, groupColor } from '../group-color';
import { entityColor } from './entity-color';

describe('entityColor', () => {
  it('gives every entity its group color', () => {
    const model = buildModel();
    for (const e of model.entities) {
      expect(entityColor(model, e.id)).toBe(groupColor(model, e.group));
    }
  });

  it('entities in the same zone share a color, different zones differ', () => {
    const model = buildModel();
    expect(entityColor(model, 'orders')).toBe(entityColor(model, 'tags'));
    expect(entityColor(model, 'users')).not.toBe(entityColor(model, 'orders'));
  });

  it('falls back to the first palette entry for an unknown id', () => {
    expect(entityColor(buildModel(), 'no-such-entity')).toBe(GROUP_PALETTE[0]);
  });
});
