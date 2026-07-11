import { describe, expect, it } from 'vitest';

import { buildModel } from '../../test/models';
import { visibleBounds } from './visible-bounds';

describe('visibleBounds', () => {
  it('hugs every entity when nothing is hidden', () => {
    const model = buildModel();
    const b = visibleBounds(model, new Set());
    expect(b.minX).toBe(Math.min(...model.entities.map((e) => e.x)));
    expect(b.minY).toBe(Math.min(...model.entities.map((e) => e.y)));
    expect(b.maxX).toBe(Math.max(...model.entities.map((e) => e.x + e._w)));
    expect(b.maxY).toBe(Math.max(...model.entities.map((e) => e.y + e._h)));
  });

  it('excludes the entities of a hidden group', () => {
    const model = buildModel();
    const users = model.entityById.get('users')!;
    // Hiding z2 leaves only users (z1) — bounds collapse to that one card.
    expect(visibleBounds(model, new Set(['z2']))).toEqual({
      minX: users.x,
      minY: users.y,
      maxX: users.x + users._w,
      maxY: users.y + users._h,
    });
  });

  it('falls back to the content box when everything is hidden', () => {
    const model = buildModel();
    expect(visibleBounds(model, new Set(['z1', 'z2']))).toEqual({
      minX: 0,
      minY: 0,
      maxX: model._content.w,
      maxY: model._content.h,
    });
  });
});
