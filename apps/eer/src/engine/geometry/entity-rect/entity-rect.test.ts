import { describe, expect, it } from 'vitest';

import type { Entity } from '../../model/types';
import { entityRect } from './entity-rect';

const e: Entity = {
  id: 'e',
  label: 'e',
  group: 'g',
  description: null,
  fields: [],
  x: 40,
  y: 60,
  _w: 180,
  _h: 90,
};

describe('entityRect', () => {
  it('echoes the card position and measured size', () => {
    expect(entityRect(e)).toMatchObject({ x: 40, y: 60, w: 180, h: 90 });
  });

  it('derives the centre from position + half size', () => {
    const r = entityRect(e);
    expect(r.cx).toBe(40 + 180 / 2);
    expect(r.cy).toBe(60 + 90 / 2);
  });
});
