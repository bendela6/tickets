import { describe, expect, it } from 'vitest';

import { nestedRaw } from '../../test/models';
import { loadModel } from '../load-model';
import type { Model } from '../types';
import { packLayout } from './pack-layout';

function packed(): Model {
  const { model, errors } = loadModel(nestedRaw());
  if (!model || errors.length) throw new Error('fixture invalid: ' + errors.join('; '));
  return packLayout(model);
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const contains = (outer: Box, inner: Box) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const cardBox = (m: Model, id: string): Box => {
  const e = m.entityById.get(id)!;
  return { x: e.x, y: e.y, w: e._w, h: e._h };
};

describe('packLayout', () => {
  it('emits zone bounds at level 0 and subgroup bounds at level 1 with parent set', () => {
    const model = packed();
    const zone = model._groupBounds.find((b) => b.id === 'z')!;
    const sub = model._groupBounds.find((b) => b.id === 's')!;
    expect(zone).toMatchObject({ level: 0, parent: null });
    expect(sub).toMatchObject({ level: 1, parent: 'z' });
  });

  it('nests the subgroup box fully inside its zone box', () => {
    const model = packed();
    const zone = model._groupBounds.find((b) => b.id === 'z')!;
    const sub = model._groupBounds.find((b) => b.id === 's')!;
    expect(contains(zone, sub)).toBe(true);
    expect(sub.w).toBeGreaterThan(0);
    expect(sub.h).toBeGreaterThan(0);
  });

  it('places subgroup members inside the subgroup box', () => {
    const model = packed();
    const sub = model._groupBounds.find((b) => b.id === 's')!;
    expect(contains(sub, cardBox(model, 'm1'))).toBe(true);
    expect(contains(sub, cardBox(model, 'm2'))).toBe(true);
  });

  it('keeps a loose card inside the zone but clear of the subgroup', () => {
    const model = packed();
    const zone = model._groupBounds.find((b) => b.id === 'z')!;
    const sub = model._groupBounds.find((b) => b.id === 's')!;
    const loose = cardBox(model, 'loose');
    expect(contains(zone, loose)).toBe(true);
    expect(overlaps(sub, loose)).toBe(false);
  });

  it('sizes _content to cover every group box', () => {
    const model = packed();
    for (const b of model._groupBounds) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(model._content.w);
      expect(b.y + b.h).toBeLessThanOrEqual(model._content.h);
    }
  });

  it('is deterministic: re-packing the same model reproduces identical geometry', () => {
    // The header promises stable re-runs — Rearrange and the font-ready re-pack
    // rely on it (nothing may drift when packLayout runs again on live state).
    const model = packed();
    const snapEnts = model.entities.map((e) => ({ id: e.id, x: e.x, y: e.y, w: e._w, h: e._h }));
    const snapBounds = model._groupBounds.map((b) => ({ ...b }));
    const snapContent = { ...model._content };
    packLayout(model);
    expect(model.entities.map((e) => ({ id: e.id, x: e.x, y: e.y, w: e._w, h: e._h }))).toEqual(snapEnts);
    expect(model._groupBounds).toEqual(snapBounds);
    expect(model._content).toEqual(snapContent);
  });
});
