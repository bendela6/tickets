// Geometry — the single source of truth for card sizing and port positions. Both
// the renderer (DOM ports) and edge drawing use portWorldPos(), so an edge endpoint
// and its port element occupy the exact same world coordinate by construction, and
// portWorldPos mirrors the CSS box model (border + body padding) exactly.

import type { Entity, Model, Point, Relationship, Side } from './types';

export const HEADER_H = 34; // .card-hd height (must match app.css)
export const ROW_H = 22; // .field height
export const PORT_GAP = 8; // dot distance from card edge
export const CARD_BORDER = 1; // .card border-width
export const BODY_PAD_TOP = 3; // .card-body padding-top
export const CARD_MIN_W = 156;
export const CARD_MAX_W = 320;
export const LAYOUT_MARGIN = 80;

const MONO = 'ui-monospace, "IBM Plex Mono", Menlo, Consolas, monospace';

let ctx: CanvasRenderingContext2D | null | undefined;
function measureText(s: string, font: string): number {
  if (ctx === undefined) ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return (s ? s.length : 0) * 7; // jsdom / no-canvas fallback
  ctx.font = font;
  return ctx.measureText(s || '').width;
}

// Compute + cache card width/height. Width is chosen by measuring text but FORCED as
// the card's CSS width, so ports stay aligned regardless of font-load timing.
export function measureEntity(e: Entity): Entity {
  const label = e.label || e.id;
  let w = measureText(label, '500 13px ' + MONO) + 28;
  for (const f of e.fields) {
    const nameW = measureText(f.name, '500 12px ' + MONO);
    const typeW = measureText(f.type || '', '400 11px ' + MONO);
    const badgeW = f.role ? 24 : 6;
    const rowW = badgeW + nameW + 18 + typeW + 22;
    if (rowW > w) w = rowW;
  }
  e._w = Math.max(CARD_MIN_W, Math.min(CARD_MAX_W, Math.round(w)));
  e._h = HEADER_H + e.fields.length * ROW_H;
  return e;
}

export function fieldIndex(e: Entity, name: string): number {
  return e.fields.findIndex((f) => f.name === name);
}

export function portWorldPos(e: Entity, i: number, side: Side): Point {
  return {
    x: side === 'L' ? e.x + CARD_BORDER - PORT_GAP : e.x + e._w - CARD_BORDER + PORT_GAP,
    y: e.y + CARD_BORDER + HEADER_H + BODY_PAD_TOP + i * ROW_H + ROW_H / 2,
  };
}

export function entityRect(e: Entity) {
  return { x: e.x, y: e.y, w: e._w, h: e._h, cx: e.x + e._w / 2, cy: e.y + e._h / 2 };
}

export interface EdgeEndpoints {
  p1: Point;
  p2: Point;
  s: Side;
  t: Side;
  self: boolean;
  A: Entity;
  B: Entity;
}

// Which side (L/R) each end exits from. Pick the L/R × L/R combination whose two
// ports are closest — for side-by-side cards this is the facing sides; for cards
// stacked vertically it connects both on the SAME side (shortest path, no wrap-around).
export function edgeSides(model: Model, rel: Relationship): { s: Side; t: Side } {
  if (rel.source === rel.target) return { s: 'R', t: 'R' };
  const A = model.entityById.get(rel.source)!;
  const B = model.entityById.get(rel.target)!;
  const ai = fieldIndex(A, rel.sourceField);
  const bi = fieldIndex(B, rel.targetField);
  const sides: Side[] = ['L', 'R'];
  let best: { s: Side; t: Side } = { s: 'R', t: 'L' };
  let bestD = Infinity;
  for (const s of sides) {
    for (const t of sides) {
      const p1 = portWorldPos(A, ai, s);
      const p2 = portWorldPos(B, bi, t);
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (d < bestD) {
        bestD = d;
        best = { s, t };
      }
    }
  }
  return best;
}

// World-space endpoints of a relationship: the two field ports it connects.
export function edgeEndpoints(model: Model, rel: Relationship): EdgeEndpoints {
  const A = model.entityById.get(rel.source)!;
  const B = model.entityById.get(rel.target)!;
  const ai = fieldIndex(A, rel.sourceField);
  const bi = fieldIndex(B, rel.targetField);
  const { s, t } = edgeSides(model, rel);
  return { p1: portWorldPos(A, ai, s), p2: portWorldPos(B, bi, t), s, t, self: rel.source === rel.target, A, B };
}
