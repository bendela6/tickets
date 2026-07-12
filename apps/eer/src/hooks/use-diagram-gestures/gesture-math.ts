// Pure gesture geometry — ported verbatim from the legacy imperative diagram
// engine's interaction code (now deleted, see git history pre-T16). No DOM writes,
// no dispatch: given inputs, return numbers. The hook (use-diagram-gestures) drives
// these and turns results into dispatches.

import { entityIdsInGroup } from '../../engine/groups/entity-ids-in-group';
import type { Entity, GroupBounds, Model } from '../../engine/model/types';

export const DRAG_THRESHOLD = 3;
export const RESIZE_EDGE = 8; // screen px: grab distance from a group edge to resize it
export const IN_PAD = 8; // world px: children keep this inset inside their group box
export const IN_LABEL = 30; // world px: children stay below the group label
export const MIN_W = 140; // min group box width
export const MIN_H = 80; // min group box height
export const ZOOM_MIN = 0.15;
export const ZOOM_MAX = 3;
export const WHEEL_K = 0.0015; // zoom factor exponent per wheel delta

export interface EdgeMask {
  l: boolean;
  r: boolean;
  t: boolean;
  b: boolean;
}

export type ContentBounds = { minX: number; minY: number; maxX: number; maxY: number };

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// eer-diagram.ts:41 — which edge(s) of `el` the pointer is within RESIZE_EDGE of.
export function edgeMaskFor(el: HTMLElement, e: MouseEvent): EdgeMask | null {
  const r = el.getBoundingClientRect();
  // jsdom rects are 0×0 — treat as "not near an edge" so tests exercise the group path.
  if (r.width === 0 && r.height === 0) return null;
  const m: EdgeMask = {
    l: e.clientX - r.left <= RESIZE_EDGE,
    r: r.right - e.clientX <= RESIZE_EDGE,
    t: e.clientY - r.top <= RESIZE_EDGE,
    b: r.bottom - e.clientY <= RESIZE_EDGE,
  };
  return m.l || m.r || m.t || m.b ? m : null;
}

// eer-diagram.ts:52 — the CSS cursor for a grabbed edge/corner.
export function cursorFor(m: EdgeMask): string {
  if ((m.l && m.t) || (m.r && m.b)) return 'nwse-resize';
  if ((m.r && m.t) || (m.l && m.b)) return 'nesw-resize';
  if (m.l || m.r) return 'ew-resize';
  return 'ns-resize';
}

// eer-diagram.ts:335 — union of a group's children (member cards, and for a zone
// its subgroup boxes): the box may never be resized smaller than this.
export function contentBoundsOf(model: Model, gid: string): ContentBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of entityIdsInGroup(model, gid)) {
    const en = model.entityById.get(id)!;
    minX = Math.min(minX, en.x);
    minY = Math.min(minY, en.y);
    maxX = Math.max(maxX, en.x + en._w);
    maxY = Math.max(maxY, en.y + en._h);
  }
  for (const sb of model._groupBounds) {
    if (sb.parent !== gid) continue;
    minX = Math.min(minX, sb.x);
    minY = Math.min(minY, sb.y);
    maxX = Math.max(maxX, sb.x + sb.w);
    maxY = Math.max(maxY, sb.y + sb.h);
  }
  return isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

// eer-diagram.ts:457 — a dragged card stays inside its group box. The min-after-max
// order keeps the left/top edge winning when the box is smaller than the card.
export function clampCardToBox(x: number, y: number, e: Entity, b: GroupBounds): { x: number; y: number } {
  return {
    x: Math.max(Math.min(x, b.x + b.w - IN_PAD - e._w), b.x + IN_PAD),
    y: Math.max(Math.min(y, b.y + b.h - IN_PAD - e._h), b.y + IN_LABEL),
  };
}

// eer-diagram.ts:492-517 — the resize clamp chain: apply the grabbed edge delta,
// never cut children off (content), stay inside the parent zone, enforce min size
// with the grabbed side keeping priority.
export function resizeBox(
  s0: { x: number; y: number; w: number; h: number },
  mask: EdgeMask,
  wdx: number,
  wdy: number,
  content: ContentBounds | null,
  parent: GroupBounds | null,
): { x: number; y: number; w: number; h: number } {
  let x1 = s0.x + (mask.l ? wdx : 0);
  let y1 = s0.y + (mask.t ? wdy : 0);
  let x2 = s0.x + s0.w + (mask.r ? wdx : 0);
  let y2 = s0.y + s0.h + (mask.b ? wdy : 0);
  // Never cut children off.
  if (content) {
    if (mask.l) x1 = Math.min(x1, content.minX - IN_PAD);
    if (mask.t) y1 = Math.min(y1, content.minY - IN_LABEL);
    if (mask.r) x2 = Math.max(x2, content.maxX + IN_PAD);
    if (mask.b) y2 = Math.max(y2, content.maxY + IN_PAD);
  }
  // A subgroup box stays inside its parent zone.
  if (parent) {
    if (mask.l) x1 = Math.max(x1, parent.x + IN_PAD);
    if (mask.t) y1 = Math.max(y1, parent.y + IN_LABEL);
    if (mask.r) x2 = Math.min(x2, parent.x + parent.w - IN_PAD);
    if (mask.b) y2 = Math.min(y2, parent.y + parent.h - IN_PAD);
  }
  // Minimum usable size, grabbed side keeps its position.
  if (x2 - x1 < MIN_W) mask.l ? (x1 = x2 - MIN_W) : (x2 = x1 + MIN_W);
  if (y2 - y1 < MIN_H) mask.t ? (y1 = y2 - MIN_H) : (y2 = y1 + MIN_H);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
