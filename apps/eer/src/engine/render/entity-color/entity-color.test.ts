import { describe, expect, it } from 'vitest';

import { buildModel, pkField } from '../../../test/models';
import { EDGE_PALETTE, entityColor } from './entity-color';

describe('entityColor', () => {
  it('assigns palette colors by entity index', () => {
    const model = buildModel();
    model.entities.forEach((e, i) => {
      expect(entityColor(model, e.id)).toBe(EDGE_PALETTE[i % EDGE_PALETTE.length]);
    });
  });

  it('is stable across calls for the same id', () => {
    const model = buildModel();
    expect(entityColor(model, 'orders')).toBe(entityColor(model, 'orders'));
    expect(entityColor(model, 'orders')).not.toBe(entityColor(model, 'users'));
  });

  it('cycles back to the first color once the palette is exhausted', () => {
    const raw = {
      groups: [{ id: 'z', label: 'Zone', order: 0 }],
      entities: Array.from({ length: EDGE_PALETTE.length + 1 }, (_, i) => ({
        id: 'e' + i,
        group: 'z',
        fields: [pkField],
      })),
    };
    const model = buildModel(raw);
    expect(entityColor(model, 'e' + EDGE_PALETTE.length)).toBe(EDGE_PALETTE[0]);
    expect(entityColor(model, 'e1')).toBe(EDGE_PALETTE[1]);
  });

  it('falls back to the first palette entry for an unknown id', () => {
    expect(entityColor(buildModel(), 'no-such-entity')).toBe(EDGE_PALETTE[0]);
  });
});
