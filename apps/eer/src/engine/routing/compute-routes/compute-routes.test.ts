import { describe, expect, it } from 'vitest';

import { buildModel, fkTo, pkField } from '../../../test/models';
import { pinSlots } from '../../geometry/compute-pin-slots';
import { edgeEndpoints } from '../../geometry/edge-endpoints';
import { STUB } from '../../geometry/metrics';
import { routeEdges } from './compute-routes';
import type { Point } from '../../model/types';

// Axis-aligned segment vs rect overlap (strict, so a 2px-shrunk rect gives tolerance).
function segHitsRect(a: Point, b: Point, x: number, y: number, w: number, h: number): boolean {
  const x2 = x + w;
  const y2 = y + h;
  if (Math.abs(a.y - b.y) < 0.01) return a.y > y && a.y < y2 && Math.min(a.x, b.x) < x2 && Math.max(a.x, b.x) > x;
  return a.x > x && a.x < x2 && Math.min(a.y, b.y) < y2 && Math.max(a.y, b.y) > y;
}

describe('routeEdges', () => {
  it('gives every non-self relationship an axis-aligned route of at least 2 points', () => {
    const model = buildModel();
    const { slots } = pinSlots(model);
    const { routes } = routeEdges(model, slots);
    for (const rel of model.relationships) {
      if (rel.source === rel.target) continue;
      const pts = routes.get(rel.id)!;
      expect(pts, rel.id).toBeTruthy();
      expect(pts.length, rel.id).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < pts.length; i++) {
        const dx = Math.abs(pts[i]!.x - pts[i - 1]!.x);
        const dy = Math.abs(pts[i]!.y - pts[i - 1]!.y);
        expect(Math.min(dx, dy), `${rel.id} segment ${i} must be H or V`).toBeLessThan(0.01);
      }
    }
  });

  it('anchors each route at the edge endpoints', () => {
    const model = buildModel();
    const { slots } = pinSlots(model);
    const { routes, slots: adjusted } = routeEdges(model, slots);
    for (const rel of model.relationships) {
      if (rel.source === rel.target) continue;
      const pts = routes.get(rel.id)!;
      // after routing — slots may have been reordered
      const { p1, p2 } = edgeEndpoints(model, rel, adjusted.get(rel.id));
      const first = pts[0]!;
      const last = pts[pts.length - 1]!;
      expect(Math.abs(first.x - p1.x), rel.id).toBeLessThanOrEqual(0.5);
      expect(Math.abs(first.y - p1.y), rel.id).toBeLessThanOrEqual(0.5);
      expect(Math.abs(last.x - p2.x), rel.id).toBeLessThanOrEqual(0.5);
      expect(Math.abs(last.y - p2.y), rel.id).toBeLessThanOrEqual(0.5);
    }
  });

  it('routes around every card body except the edge’s own endpoints', () => {
    const model = buildModel();
    const { slots } = pinSlots(model);
    const { routes } = routeEdges(model, slots);
    for (const rel of model.relationships) {
      const pts = routes.get(rel.id);
      if (!pts) continue;
      const obstacles = model.entities.filter((e) => e.id !== rel.source && e.id !== rel.target);
      for (let i = 1; i < pts.length; i++) {
        for (const e of obstacles) {
          expect(
            segHitsRect(pts[i - 1]!, pts[i]!, e.x + 2, e.y + 2, e._w - 4, e._h - 4),
            `${rel.id} segment ${i} crosses card "${e.id}"`,
          ).toBe(false);
        }
      }
    }
  });

  it('keeps port stubs at full length when lane separation shifts their verticals', () => {
    const raw = {
      groups: [{ id: 'z', label: 'Z', order: 0 }],
      entities: [
        { id: 'a', group: 'z', fields: [pkField] },
        { id: 'b', group: 'z', fields: [pkField] },
        { id: 'wall', group: 'z', fields: [pkField] },
        { id: 't', group: 'z', fields: [pkField, fkTo('a'), fkTo('b')] },
      ],
      relationships: [
        { id: 'a-t', source: 'a', sourceField: 'id', target: 't', targetField: 'a_id' },
        { id: 'b-t', source: 'b', sourceField: 'id', target: 't', targetField: 'b_id' },
      ],
    };
    const model = buildModel(raw);
    // Stack both sources below-left of the target with a wall above them: both
    // verticals must climb the corridor just left of t with overlapping spans,
    // so lane separation has to shift one — toward t is the first lane candidate.
    Object.assign(model.entityById.get('a')!, { x: 0, y: 360, _w: 140, _h: 60 });
    Object.assign(model.entityById.get('b')!, { x: 0, y: 480, _w: 140, _h: 60 });
    Object.assign(model.entityById.get('wall')!, { x: 100, y: 120, _w: 240, _h: 200 });
    Object.assign(model.entityById.get('t')!, { x: 400, y: 0, _w: 140, _h: 100 });
    const { slots } = pinSlots(model);
    const { routes } = routeEdges(model, slots);
    for (const rel of model.relationships) {
      const pts = routes.get(rel.id)!;
      const last = pts[pts.length - 1]!;
      const beforeLast = pts[pts.length - 2]!;
      expect(Math.abs(beforeLast.y - last.y), `${rel.id} tail must stay horizontal`).toBeLessThan(0.01);
      expect(Math.abs(beforeLast.x - last.x), `${rel.id} target stub length`).toBeGreaterThanOrEqual(STUB - 0.5);
      expect(Math.abs(pts[1]!.x - pts[0]!.x), `${rel.id} source stub length`).toBeGreaterThanOrEqual(STUB - 0.5);
    }
  });

  it('maps a self-loop route to null', () => {
    const model = buildModel();
    const { slots } = pinSlots(model);
    const { routes } = routeEdges(model, slots);
    expect(routes.get('rel:users:c2')).toBeNull();
  });

  it('is pure — repeated calls with the same inputs agree and never mutate the model', () => {
    const model = buildModel();
    const { slots } = pinSlots(model);
    const modelSnap = JSON.stringify(model, (_, v: unknown) => (v instanceof Map ? [...v] : v));
    const res1 = routeEdges(model, slots);
    expect(JSON.stringify(model, (_, v: unknown) => (v instanceof Map ? [...v] : v))).toBe(modelSnap);
    expect(res1.slots).not.toBe(slots); // adjusted copy, never the caller's map

    const res2 = routeEdges(model, slots);
    for (const rel of model.relationships) {
      expect(res2.routes.get(rel.id) ?? null).toEqual(res1.routes.get(rel.id) ?? null);
    }
  });
});

// Two segments "overlap" when they are collinear (same axis + same cross-coord
// within the casing width) and their spans intersect for more than a point.
// The pin fan at a shared port separates slots by < casing, so endpoints that
// touch at a port are excluded by the 6px span-trim.
function overlappingPairs(routes: Map<string, Point[] | null>): string[] {
  interface Run { rel: string; axis: 'h' | 'v'; cross: number; lo: number; hi: number }
  const runs: Run[] = [];
  for (const [rel, pts] of routes) {
    if (!pts) continue;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      if (Math.abs(a.y - b.y) < 0.01 && Math.abs(a.x - b.x) > 12) {
        runs.push({ rel, axis: 'h', cross: a.y, lo: Math.min(a.x, b.x) + 6, hi: Math.max(a.x, b.x) - 6 });
      } else if (Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) > 12) {
        runs.push({ rel, axis: 'v', cross: a.x, lo: Math.min(a.y, b.y) + 6, hi: Math.max(a.y, b.y) - 6 });
      }
    }
  }
  const bad: string[] = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const p = runs[i]!;
      const q = runs[j]!;
      if (p.rel === q.rel || p.axis !== q.axis) continue;
      if (Math.abs(p.cross - q.cross) >= 4.5) continue; // casing width — visually merged below this
      if (p.lo < q.hi && q.lo < p.hi) bad.push(`${p.rel} ∥ ${q.rel} @ ${p.axis}=${Math.round(p.cross)}`);
    }
  }
  return bad;
}

it('a hub fanned to three stacked targets gets a distinct lane per edge', () => {
  const raw = {
    groups: [{ id: 'z', label: 'Z', order: 0 }],
    entities: [
      { id: 'hub', group: 'z', fields: [pkField] },
      { id: 'ta', group: 'z', fields: [pkField, fkTo('hub')] },
      { id: 'tb', group: 'z', fields: [pkField, fkTo('hub')] },
      { id: 'tc', group: 'z', fields: [pkField, fkTo('hub')] },
    ],
    relationships: [
      { id: 'h-a', source: 'hub', sourceField: 'id', target: 'ta', targetField: 'hub_id' },
      { id: 'h-b', source: 'hub', sourceField: 'id', target: 'tb', targetField: 'hub_id' },
      { id: 'h-c', source: 'hub', sourceField: 'id', target: 'tc', targetField: 'hub_id' },
    ],
  };
  const model = buildModel(raw);
  // Hub on the left, three targets stacked close together just to its right — the
  // gap is too narrow for separateAxis to give every vertical run its own lane, so
  // the stay-put fallback stacks them onto a shared jog instead.
  Object.assign(model.entityById.get('hub')!, { x: 0, y: 300, _w: 140, _h: 60 });
  Object.assign(model.entityById.get('ta')!, { x: 170, y: 0, _w: 140, _h: 80 });
  Object.assign(model.entityById.get('tb')!, { x: 170, y: 90, _w: 140, _h: 80 });
  Object.assign(model.entityById.get('tc')!, { x: 170, y: 180, _w: 140, _h: 80 });
  const { slots } = pinSlots(model);
  const { routes } = routeEdges(model, slots);
  expect(overlappingPairs(routes)).toEqual([]);
});

it('packs a corridor with more parallel runs than clean lanes, forcing a separated-but-blocked lane', () => {
  // Ten sources stacked well below a shared wall, all fanning into one target
  // above it — the same "climb past a wall into the target" shape as the port-
  // stub test above, but with far more parallel verticals than the wall's gap
  // (x 100–340) has room for as distinct, unblocked lanes. Once the clear
  // lanes on both sides of the wall are exhausted, later (shorter) runs can
  // find lanes that are separated from every placed run but only by landing
  // back inside the wall's own footprint — the fallback tier this test
  // targets. Without it, those runs stay put at their shared A* lane (the
  // target's approach column) and stack directly on top of each other.
  const N = 10;
  const raw = {
    groups: [{ id: 'z', label: 'Z', order: 0 }],
    entities: [
      ...Array.from({ length: N }, (_, i) => ({ id: 'a' + i, group: 'z', fields: [pkField] })),
      { id: 't', group: 'z', fields: [pkField, ...Array.from({ length: N }, (_, i) => fkTo('a' + i))] },
      { id: 'wall', group: 'z', fields: [pkField] },
    ],
    relationships: Array.from({ length: N }, (_, i) => ({
      id: 'h-' + i,
      source: 'a' + i,
      sourceField: 'id',
      target: 't',
      targetField: 'a' + i + '_id',
    })),
  };
  const model = buildModel(raw);
  for (let i = 0; i < N; i++) {
    Object.assign(model.entityById.get('a' + i)!, { x: 0, y: 360 + i * 80, _w: 140, _h: 60 });
  }
  Object.assign(model.entityById.get('t')!, { x: 400, y: 0, _w: 140, _h: 100 });
  Object.assign(model.entityById.get('wall')!, { x: 100, y: 120, _w: 240, _h: 200 });
  const { slots } = pinSlots(model);
  const { routes } = routeEdges(model, slots);

  // No two overlapping collinear runs ever stack, even under this much lane
  // pressure — the outcome the fallback tier exists to guarantee.
  expect(overlappingPairs(routes)).toEqual([]);

  // And the pressure was real: with only 240px of wall and ~9px lanes, some
  // run's assigned vertical must have landed inside the wall's own footprint
  // (separated from its neighbours, but genuinely card-blocked) rather than
  // finding a fully clear lane on either side of it.
  const wall = model.entityById.get('wall')!;
  let sawWallCrossing = false;
  for (const pts of routes.values()) {
    if (!pts) continue;
    for (let i = 1; i < pts.length; i++) {
      if (segHitsRect(pts[i - 1]!, pts[i]!, wall.x, wall.y, wall._w, wall._h)) sawWallCrossing = true;
    }
  }
  expect(sawWallCrossing).toBe(true);
});
