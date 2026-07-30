import { describe, expect, it } from 'vitest';

import { buildModel } from '../../../test/models';
import { entityColor } from '../entity-color';
import { GROUP_PALETTE } from '../group-color';
import { edgeColor } from './edge-color';

describe('edgeColor', () => {
  it('returns the entity color from the model for every entity', () => {
    const model = buildModel();
    for (const e of model.entities) {
      expect(edgeColor(model, e.id)).toBe(entityColor(model, e.id));
    }
  });

  it('applies overrides when provided', () => {
    const model = buildModel();
    const entity = model.entities[0]!;
    const overrides = new Map([[entity.id, '#ff0000']]);
    expect(edgeColor(model, entity.id, overrides)).toBe(entityColor(model, entity.id, overrides));
  });

  it('falls back to the first palette entry for an unknown id', () => {
    const model = buildModel();
    expect(edgeColor(model, 'no-such-entity')).toBe(GROUP_PALETTE[0]);
  });
});
