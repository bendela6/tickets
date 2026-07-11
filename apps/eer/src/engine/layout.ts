// Layout — deterministic group packing (no physics, so re-runs are stable and
// nothing drifts). Sets entity.x/y, group bounds, and content size.

import { LAYOUT_MARGIN, measureEntity } from './geometry';
import type { Entity, GroupBounds, Model } from './types';

const GROUP_PAD = 40;
const GROUP_LABEL_H = 30;
const CARD_VGAP = 72;
const CARD_HGAP = 120;
const GROUP_GAP = 220;
const TARGET_COL_H = 1100;

export function packLayout(model: Model): Model {
  model.entities.forEach(measureEntity);

  const byGroup = new Map<string, Entity[]>();
  for (const g of model.groups) byGroup.set(g.id, []);
  for (const e of model.entities) byGroup.get(e.group)?.push(e);

  let gx = LAYOUT_MARGIN;
  const groupBounds: GroupBounds[] = [];

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
        colX = colX + colW + CARD_HGAP;
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

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function visibleBounds(model: Model, hiddenGroups: Set<string>): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const e of model.entities) {
    if (hiddenGroups.has(e.group)) continue;
    minX = Math.min(minX, e.x);
    minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + e._w);
    maxY = Math.max(maxY, e.y + e._h);
  }
  if (!isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: model._content.w, maxY: model._content.h };
  }
  return { minX, minY, maxX, maxY };
}
