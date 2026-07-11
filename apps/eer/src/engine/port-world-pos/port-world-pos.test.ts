import { describe, expect, it } from 'vitest';

import { BODY_PAD_TOP, CARD_BORDER, HEADER_H, PORT_GAP, ROW_H } from '../metrics';
import type { Entity } from '../types';
import { portWorldPos } from './port-world-pos';

// Geometry only — no measuring involved, so we can hand it a pre-sized entity.
const e: Entity = {
  id: 'e',
  label: 'e',
  group: 'g',
  description: null,
  fields: [],
  x: 100,
  y: 50,
  _w: 200,
  _h: 100,
};

describe('portWorldPos', () => {
  it('puts the L port just outside the left border', () => {
    expect(portWorldPos(e, 0, 'L').x).toBe(e.x + CARD_BORDER - PORT_GAP);
  });

  it('puts the R port just outside the right border', () => {
    expect(portWorldPos(e, 0, 'R').x).toBe(e.x + e._w - CARD_BORDER + PORT_GAP);
  });

  it('centres row 0 below the header and advances by ROW_H per field index', () => {
    const y0 = portWorldPos(e, 0, 'L').y;
    expect(y0).toBe(e.y + CARD_BORDER + HEADER_H + BODY_PAD_TOP + ROW_H / 2);
    expect(portWorldPos(e, 1, 'L').y).toBe(y0 + ROW_H);
    expect(portWorldPos(e, 4, 'R').y).toBe(y0 + 4 * ROW_H); // same rows on both sides
  });
});
