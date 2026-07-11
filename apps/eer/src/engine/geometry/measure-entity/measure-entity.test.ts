import { describe, expect, it } from 'vitest';

import { CARD_MAX_W, CARD_MIN_W, HEADER_H, ROW_H } from '../metrics';
import type { Entity, Field } from '../../model/types';
import { measureEntity } from './measure-entity';

// jsdom has no canvas, so text measuring falls back to 7px/char — assert bounds
// and monotonicity, never exact pixel widths.

const field = (name: string, type = 'int', role: Field['role'] = null): Field => ({
  name,
  type,
  role,
  ref: null,
  refField: null,
  title: null,
  description: null,
});

const entity = (fields: Field[], label = 'e'): Entity => ({
  id: 'e',
  label,
  group: 'g',
  description: null,
  fields,
  x: 0,
  y: 0,
  _w: 0,
  _h: 0,
});

describe('measureEntity', () => {
  it('clamps width to [CARD_MIN_W, CARD_MAX_W]', () => {
    const tiny = measureEntity(entity([field('id')]));
    expect(tiny._w).toBe(CARD_MIN_W); // one short row measures under the floor

    const huge = measureEntity(entity([field('x'.repeat(200))]));
    expect(huge._w).toBe(CARD_MAX_W);
  });

  it('widens (or clamps) as field names grow longer', () => {
    const mid = measureEntity(entity([field('x'.repeat(20))]));
    const wider = measureEntity(entity([field('x'.repeat(25))]));
    expect(mid._w).toBeGreaterThan(CARD_MIN_W); // in the unclamped band, so growth is observable
    expect(wider._w).toBeLessThan(CARD_MAX_W);
    expect(wider._w).toBeGreaterThan(mid._w);
  });

  it('sets height to HEADER_H plus one ROW_H per field', () => {
    expect(measureEntity(entity([field('id')]))._h).toBe(HEADER_H + ROW_H);
    expect(measureEntity(entity([field('a'), field('b'), field('c')]))._h).toBe(HEADER_H + 3 * ROW_H);
  });

  it('mutates and returns the same entity (a cache, not a copy)', () => {
    const e = entity([field('id')]);
    expect(measureEntity(e)).toBe(e);
  });
});
