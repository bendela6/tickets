// Compute + cache card width/height. Width is chosen by measuring text but FORCED
// as the card's CSS width, so ports stay aligned regardless of font-load timing.

import { CARD_MAX_W, CARD_MIN_W, HEADER_H, ROW_H } from '../metrics';
import type { Entity } from '../../model/types';

const MONO = 'ui-monospace, "IBM Plex Mono", Menlo, Consolas, monospace';

let ctx: CanvasRenderingContext2D | null | undefined;
function measureText(s: string, font: string): number {
  if (ctx === undefined) ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return (s ? s.length : 0) * 7; // jsdom / no-canvas fallback
  ctx.font = font;
  return ctx.measureText(s || '').width;
}

export function measureEntity(e: Entity): Entity {
  const label = e.label || e.id;
  let w = measureText(label, '500 13px ' + MONO) + 32;
  for (const f of e.fields) {
    const nameW = measureText(f.name, '500 12px ' + MONO);
    const typeW = measureText(f.type || '', '400 11px ' + MONO);
    const badgeW = f.role ? 28 : 8;
    const rowW = badgeW + nameW + 20 + typeW + 26;
    if (rowW > w) w = rowW;
  }
  e._w = Math.max(CARD_MIN_W, Math.min(CARD_MAX_W, Math.round(w)));
  e._h = HEADER_H + e.fields.length * ROW_H;
  return e;
}
