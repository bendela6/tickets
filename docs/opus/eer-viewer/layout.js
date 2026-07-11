// Layout — deterministic group packing (no physics, so re-runs are stable and
// nothing drifts). Sets entity.x/y, group bounds, and content size.

import { measureEntity, LAYOUT_MARGIN } from './geometry.js';

const GROUP_PAD = 26; // inner padding between zone edge and cards
const GROUP_LABEL_H = 28; // reserve space for the zone label
const CARD_VGAP = 26;
const CARD_HGAP = 40;
const GROUP_GAP = 74;
const TARGET_COL_H = 900; // start a new sub-column once a column passes this

export function packLayout(model) {
  model.entities.forEach(measureEntity);

  const byGroup = new Map();
  for (const g of model.groups) byGroup.set(g.id, []);
  for (const e of model.entities) {
    if (byGroup.has(e.group)) byGroup.get(e.group).push(e);
  }

  let gx = LAYOUT_MARGIN;
  const groupBounds = [];

  for (const g of model.groups) {
    const ents = byGroup.get(g.id) || [];
    const top = LAYOUT_MARGIN + GROUP_LABEL_H + GROUP_PAD;
    let colX = gx + GROUP_PAD;
    let curY = top;
    let colW = 0;
    let groupRight = colX;
    let maxBottom = top;

    for (const e of ents) {
      if (curY !== top && curY + e._h > top + TARGET_COL_H) {
        colX = colX + colW + CARD_HGAP; // wrap into a new sub-column
        curY = top;
        colW = 0;
      }
      e.x = colX;
      e.y = curY;
      curY += e._h + CARD_VGAP;
      colW = Math.max(colW, e._w);
      groupRight = Math.max(groupRight, colX + colW);
      maxBottom = Math.max(maxBottom, e.y + e._h);
    }

    const bx = gx;
    const by = LAYOUT_MARGIN;
    const bw = Math.max(groupRight + GROUP_PAD - gx, 170);
    const bh = Math.max(maxBottom + GROUP_PAD - by, 120);
    groupBounds.push({ id: g.id, label: g.label, x: bx, y: by, w: bw, h: bh });
    gx = bx + bw + GROUP_GAP;
  }

  model._groupBounds = groupBounds;

  let cw = 0;
  let ch = 0;
  for (const b of groupBounds) {
    cw = Math.max(cw, b.x + b.w);
    ch = Math.max(ch, b.y + b.h);
  }
  model._content = { w: cw + LAYOUT_MARGIN, h: ch + LAYOUT_MARGIN };
  return model;
}

// Bounding box (world coords) of currently-visible entities.
export function visibleBounds(state) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of state.model.entities) {
    if (state.hidden.groups.has(e.group)) continue;
    minX = Math.min(minX, e.x);
    minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + e._w);
    maxY = Math.max(maxY, e.y + e._h);
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = state.model._content.w;
    maxY = state.model._content.h;
  }
  return { minX, minY, maxX, maxY };
}

export function fitToView(state) {
  const vp = state.els.viewport;
  const vw = vp.clientWidth;
  const vh = vp.clientHeight;
  const b = visibleBounds(state);
  const pad = 56;
  const bw = b.maxX - b.minX + pad * 2;
  const bh = b.maxY - b.minY + pad * 2;
  const zoom = Math.max(0.15, Math.min(vw / bw, vh / bh, 1.6));
  state.view.zoom = zoom;
  state.view.panX = (vw - bw * zoom) / 2 - (b.minX - pad) * zoom;
  state.view.panY = (vh - bh * zoom) / 2 - (b.minY - pad) * zoom;
  state.applyTransform();
}

export function centerOn(state, id) {
  const e = state.model.entityById.get(id);
  if (!e) return;
  const vp = state.els.viewport;
  const cx = e.x + e._w / 2;
  const cy = e.y + e._h / 2;
  state.view.panX = vp.clientWidth / 2 - cx * state.view.zoom;
  state.view.panY = vp.clientHeight / 2 - cy * state.view.zoom;
  state.applyTransform();
}
