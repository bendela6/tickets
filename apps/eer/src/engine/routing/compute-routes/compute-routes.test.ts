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
    expect(routes.get('self')).toBeNull();
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
