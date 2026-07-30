import { describe, it, expect } from 'vitest';
import { buildModel } from '../../../test/models';
import { hiddenIds } from './hidden-ids';

describe('hiddenIds', () => {
  it('hiding a zone hides its cards, boxes, and touching edges; kind filter hides edges only', () => {
    const model = buildModel();
    const h = hiddenIds(model, new Set(['z1']), new Set());
    expect(h.entities).toEqual(new Set(['users']));
    expect(h.groups).toEqual(new Set(['z1']));
    expect(h.edges).toEqual(new Set(['rel:orders:c2', 'rel:users:c2']));
    const k = hiddenIds(model, new Set(), new Set(['fk']));
    expect(k.entities.size).toBe(0);
    expect(k.edges).toEqual(new Set(['rel:orders:c2', 'rel:orders:c3', 'rel:users:c2']));
  });
});
