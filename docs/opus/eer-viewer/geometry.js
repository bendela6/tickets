// Geometry — the single source of truth for card sizing and port positions.
// Both the renderer (DOM ports) and the edge drawing use portWorldPos(), so an
// edge endpoint and its port element occupy the exact same world coordinate by
// construction. checks.js verifies this invariant.

export const HEADER_H = 34; // .card-hd height (must match styles.css)
export const ROW_H = 22; // .field height (must match styles.css)
export const PORT_GAP = 8; // distance from card edge to port center (must match .port offsets)
export const CARD_BORDER = 1; // .card border-width (styles.css)
export const BODY_PAD_TOP = 3; // .card-body padding-top (styles.css)
export const CARD_MIN_W = 156;
export const CARD_MAX_W = 320;
export const LAYOUT_MARGIN = 80; // keeps all coords > PORT_GAP so nothing lands at a negative x

let _ctx = null;
function measureText(s, font) {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
  _ctx.font = font;
  return _ctx.measureText(s || '').width;
}

// Compute and cache the card width/height on the entity. Width is *chosen* by
// measuring text but then FORCED as the card's CSS width, so ports (offset from a
// fixed-width card) always align regardless of font-load timing.
export function measureEntity(e) {
  const label = e.label || e.id;
  let w = measureText(label, '500 13px ' + monoStack()) + 28;
  for (const f of e.fields) {
    const nameW = measureText(f.name, '500 12px ' + monoStack());
    const typeW = measureText(f.type || '', '400 11px ' + monoStack());
    const badgeW = f.role ? 24 : 6;
    const rowW = badgeW + nameW + 18 + typeW + 22;
    if (rowW > w) w = rowW;
  }
  e._w = Math.max(CARD_MIN_W, Math.min(CARD_MAX_W, Math.round(w)));
  e._h = HEADER_H + e.fields.length * ROW_H;
  return e;
}

function monoStack() {
  return 'ui-monospace, "IBM Plex Mono", Menlo, Consolas, monospace';
}

export function fieldIndex(e, name) {
  return e.fields.findIndex((f) => f.name === name);
}

// World-space center of a field's port. side is 'L' or 'R'.
// Mirrors the CSS box model exactly: the card's border insets its content, and
// card-body has a top padding — so the rendered dot sits CARD_BORDER in from each
// card edge and CARD_BORDER + BODY_PAD_TOP below the border-box top. The edge must
// land on the dot, not on the bare border-box origin. (checks.js verifies against
// the actual DOM rect so this can't silently drift again.)
export function portWorldPos(e, i, side) {
  return {
    x: side === 'L' ? e.x + CARD_BORDER - PORT_GAP : e.x + e._w - CARD_BORDER + PORT_GAP,
    y: e.y + CARD_BORDER + HEADER_H + BODY_PAD_TOP + i * ROW_H + ROW_H / 2,
  };
}

export function entityRect(e) {
  return { x: e.x, y: e.y, w: e._w, h: e._h, cx: e.x + e._w / 2, cy: e.y + e._h / 2 };
}

// Which side (L/R) each end of a relationship exits from — the facing sides, by
// relative card position. Self-references leave and re-enter on the right.
export function edgeSides(model, rel) {
  if (rel.source === rel.target) return { s: 'R', t: 'R' };
  const A = model.entityById.get(rel.source);
  const B = model.entityById.get(rel.target);
  const aCx = A.x + A._w / 2;
  const bCx = B.x + B._w / 2;
  return bCx >= aCx ? { s: 'R', t: 'L' } : { s: 'L', t: 'R' };
}

// World-space endpoints of a relationship: the two field ports it connects.
export function edgeEndpoints(model, rel) {
  const A = model.entityById.get(rel.source);
  const B = model.entityById.get(rel.target);
  const ai = fieldIndex(A, rel.sourceField);
  const bi = fieldIndex(B, rel.targetField);
  const { s, t } = edgeSides(model, rel);
  return { p1: portWorldPos(A, ai, s), p2: portWorldPos(B, bi, t), s, t, self: rel.source === rel.target, A, B };
}
