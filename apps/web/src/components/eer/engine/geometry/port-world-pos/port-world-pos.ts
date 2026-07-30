// World coordinate of a field's L/R port. This is the single source of truth both
// the renderer (DOM port dots) and edge drawing use, so an edge endpoint and its
// port element occupy the exact same world coordinate by construction — it mirrors
// the CSS box model (border + body padding) exactly.

import { BODY_PAD_TOP, CARD_BORDER, HEADER_H, PORT_GAP, ROW_H } from '../metrics';
import type { Entity, Point, Side } from '../../model/types';

export function portWorldPos(e: Entity, i: number, side: Side): Point {
  return {
    x: side === 'L' ? e.x + CARD_BORDER - PORT_GAP : e.x + e._w - CARD_BORDER + PORT_GAP,
    y: e.y + CARD_BORDER + HEADER_H + BODY_PAD_TOP + i * ROW_H + ROW_H / 2,
  };
}
