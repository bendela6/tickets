// Layout — deterministic group packing (no physics, so re-runs are stable and
// nothing drifts). Sets entity.x/y, group bounds, and content size.

import { measureEntity } from '../../geometry/measure-entity';
import { LAYOUT_MARGIN } from '../../geometry/metrics';
import type { Entity, GroupBounds, Model } from '../../model/types';

const GROUP_PAD = 40;
const GROUP_LABEL_H = 30;
const CARD_VGAP = 72;
const CARD_HGAP = 120;
const GROUP_GAP = 220;
const TARGET_COL_H = 1100;

// Subgroup (nested cluster) metrics — tighter than the zone so members read as a
// bound unit, with room for the subgroup's own label along the top.
const SUB_PAD = 18;
const SUB_LABEL_H = 26;
const SUB_VGAP = 34;

// A unit the zone-packer places: either a single loose card or a whole subgroup.
// `place(x, y)` writes the final coordinates (entity positions and, for a
// subgroup, its bounds pushed onto `groupBounds`).
interface Block {
  w: number;
  h: number;
  key: number; // sort key = first member's declaration index, keeps order intuitive
  place: (x: number, y: number) => void;
}

// Column-pack blocks from (ox, oy) top-to-bottom, wrapping to a new column once a
// column would exceed targetH. Returns the occupied right/bottom extent.
function packBlocks(
  blocks: Block[],
  ox: number,
  oy: number,
  targetH: number,
  vgap: number,
  hgap: number,
): { right: number; bottom: number } {
  let colX = ox;
  let curY = oy;
  let colW = 0;
  let right = ox;
  let bottom = oy;
  for (const b of blocks) {
    if (curY !== oy && curY + b.h > oy + targetH) {
      colX = colX + colW + hgap;
      curY = oy;
      colW = 0;
    }
    b.place(colX, curY);
    curY += b.h + vgap;
    colW = Math.max(colW, b.w);
    right = Math.max(right, colX + colW);
    bottom = Math.max(bottom, curY - vgap);
  }
  return { right, bottom };
}

export function packLayout(model: Model): Model {
  model.entities.forEach(measureEntity);

  const indexOf = new Map<string, number>();
  model.entities.forEach((e, i) => indexOf.set(e.id, i));

  const entsByGroup = new Map<string, Entity[]>();
  for (const g of model.groups) entsByGroup.set(g.id, []);
  for (const e of model.entities) entsByGroup.get(e.group)?.push(e);

  const zones = model.groups.filter((g) => !g.parent).sort((a, b) => a.order - b.order);

  const groupBounds: GroupBounds[] = [];
  let gx = LAYOUT_MARGIN;

  for (const zone of zones) {
    const blocks: Block[] = [];

    // Loose cards sitting directly in the zone (not in any subgroup).
    for (const e of entsByGroup.get(zone.id) ?? []) {
      blocks.push({
        w: e._w,
        h: e._h,
        key: indexOf.get(e.id) ?? 0,
        place: (x, y) => {
          e.x = x;
          e.y = y;
        },
      });
    }

    // Each subgroup packs its members into one tight column, then becomes a block.
    const subGroups = model.groups.filter((g) => g.parent === zone.id).sort((a, b) => a.order - b.order);
    for (const sg of subGroups) {
      const members = entsByGroup.get(sg.id) ?? [];
      if (members.length === 0) continue;
      let iy = 0;
      let iw = 0;
      for (const e of members) {
        e.x = 0; // local origin; absolute offset applied in place()
        e.y = iy;
        iy += e._h + SUB_VGAP;
        iw = Math.max(iw, e._w);
      }
      const innerH = iy - SUB_VGAP;
      const blockW = iw + SUB_PAD * 2;
      const blockH = innerH + SUB_LABEL_H + SUB_PAD * 2;
      const key = Math.min(...members.map((e) => indexOf.get(e.id) ?? 0));
      blocks.push({
        w: blockW,
        h: blockH,
        key,
        place: (x, y) => {
          for (const e of members) {
            e.x += x + SUB_PAD;
            e.y += y + SUB_LABEL_H + SUB_PAD;
          }
          groupBounds.push({ id: sg.id, label: sg.label, x, y, w: blockW, h: blockH, parent: zone.id, level: 1 });
        },
      });
    }

    blocks.sort((a, b) => a.key - b.key);

    // Push the zone bounds first (so it paints behind its subgroups), then pack —
    // subgroup blocks push their own bounds during placement — then finalize size.
    const zoneIdx = groupBounds.length;
    groupBounds.push({ id: zone.id, label: zone.label, x: gx, y: LAYOUT_MARGIN, w: 0, h: 0, parent: null, level: 0 });

    const originX = gx + GROUP_PAD;
    const originY = LAYOUT_MARGIN + GROUP_LABEL_H + GROUP_PAD;
    const { right, bottom } = packBlocks(blocks, originX, originY, TARGET_COL_H, CARD_VGAP, CARD_HGAP);

    const bw = Math.max(right + GROUP_PAD - gx, 170);
    const bh = Math.max(bottom + GROUP_PAD - LAYOUT_MARGIN, 120);
    groupBounds[zoneIdx] = { id: zone.id, label: zone.label, x: gx, y: LAYOUT_MARGIN, w: bw, h: bh, parent: null, level: 0 };

    gx = gx + bw + GROUP_GAP;
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
