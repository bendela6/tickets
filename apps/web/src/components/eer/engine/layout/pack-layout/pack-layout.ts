// Layout — deterministic group packing (no physics, so re-runs are stable and
// nothing drifts). Sets entity.x/y, group bounds, and content size.

import { measureEntity } from '../../geometry/measure-entity';
import { LAYOUT_MARGIN } from '../../geometry/metrics';
import type { Entity, Group, GroupBounds, Model } from '../../model/types';

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

export function packLayout(input: Model): Model {
  const entities = input.entities.map((e) => ({ ...e }));
  const model: Model = {
    ...input,
    entities,
    entityById: new Map(entities.map((e) => [e.id, e])),
    _groupBounds: [],
    _content: { w: 0, h: 0 },
  };

  model.entities.forEach(measureEntity);

  const indexOf = new Map<string, number>();
  model.entities.forEach((e, i) => indexOf.set(e.id, i));

  const entsByGroup = new Map<string, Entity[]>();
  for (const g of model.groups) entsByGroup.set(g.id, []);
  for (const e of model.entities) entsByGroup.get(e.group)?.push(e);

  const zones = model.groups.filter((g) => !g.parent).sort((a, b) => a.order - b.order);

  const groupBounds: GroupBounds[] = [];

  const cardBlock = (e: Entity): Block => ({
    w: e._w,
    h: e._h,
    key: indexOf.get(e.id) ?? 0,
    place: (x, y) => {
      e.x = x;
      e.y = y;
    },
  });

  const childGroupsOf = (id: string): Group[] => model.groups.filter((g) => g.parent === id).sort((a, b) => a.order - b.order);

  // A subgroup (nesting level >= 1) stacks its own loose cards and nested
  // subgroup blocks into one tight column, then becomes a single block its
  // parent packs — the recursion is what makes nesting unbounded. Returns null
  // for a subgroup with nothing to show (no cards, no non-empty descendants):
  // an empty box is not drawn, same as the flat version skipped empty ones.
  function subgroupBlock(g: Group, level: number): Block | null {
    const children: Block[] = [
      ...(entsByGroup.get(g.id) ?? []).map(cardBlock),
      ...childGroupsOf(g.id)
        .map((sg) => subgroupBlock(sg, level + 1))
        .filter((b): b is Block => b !== null),
    ];
    if (children.length === 0) return null;
    children.sort((a, b) => a.key - b.key);

    // Stack in one column, measuring the inner extent; place() applies the
    // absolute offset (and recurses into nested subgroup blocks).
    let iy = 0;
    let iw = 0;
    const placed = children.map((b) => {
      const row = { b, ly: iy };
      iy += b.h + SUB_VGAP;
      iw = Math.max(iw, b.w);
      return row;
    });
    const blockW = iw + SUB_PAD * 2;
    const blockH = iy - SUB_VGAP + SUB_LABEL_H + SUB_PAD * 2;
    const key = Math.min(...children.map((b) => b.key));
    return {
      w: blockW,
      h: blockH,
      key,
      place: (x, y) => {
        // This box paints behind its children — push its bounds FIRST.
        groupBounds.push({ id: g.id, label: g.label, x, y, w: blockW, h: blockH, parent: g.parent, level });
        const ox = x + SUB_PAD;
        const oy = y + SUB_LABEL_H + SUB_PAD;
        for (const { b, ly } of placed) b.place(ox, oy + ly);
      },
    };
  }

  let gx = LAYOUT_MARGIN;
  for (const zone of zones) {
    const blocks: Block[] = [
      ...(entsByGroup.get(zone.id) ?? []).map(cardBlock),
      ...childGroupsOf(zone.id)
        .map((sg) => subgroupBlock(sg, 1))
        .filter((b): b is Block => b !== null),
    ];
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

  // Hand-arranged positions from the file win over the packed defaults — re-apply
  // them last so reload/repack never drifts a diagram the user has laid out.
  const saved = model._savedLayout;
  if (saved) {
    for (const [id, p] of saved.entities) {
      const e = model.entityById.get(id);
      if (e) {
        e.x = p.x;
        e.y = p.y;
      }
    }
    for (const [id, b] of saved.groups) {
      const g = model._groupBounds.find((x) => x.id === id);
      if (g) {
        g.x = b.x;
        g.y = b.y;
        g.w = b.w;
        g.h = b.h;
      }
    }
    let w = model._content.w;
    let h = model._content.h;
    for (const e of model.entities) {
      w = Math.max(w, e.x + e._w + 80);
      h = Math.max(h, e.y + e._h + 80);
    }
    for (const g of model._groupBounds) {
      w = Math.max(w, g.x + g.w + 80);
      h = Math.max(h, g.y + g.h + 80);
    }
    model._content = { w, h };
  }

  return model;
}
