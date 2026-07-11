import { describe, expect, it } from 'vitest';

import { buildModel } from '../../test/models';
import { edgeEndpoints } from '../edge-endpoints';
import { computeRoutes } from './compute-routes';
import type { Point } from '../types';

// Axis-aligned segment vs rect overlap (strict, so a 2px-shrunk rect gives tolerance).
function segHitsRect(a: Point, b: Point, x: number, y: number, w: number, h: number): boolean {
  const x2 = x + w;
  const y2 = y + h;
  if (Math.abs(a.y - b.y) < 0.01) return a.y > y && a.y < y2 && Math.min(a.x, b.x) < x2 && Math.max(a.x, b.x) > x;
  return a.x > x && a.x < x2 && Math.min(a.y, b.y) < y2 && Math.max(a.y, b.y) > y;
}

describe('computeRoutes', () => {
  it('gives every non-self relationship an axis-aligned route of at least 2 points', () => {
    const model = buildModel();
    computeRoutes(model);
    for (const rel of model.relationships) {
      if (rel.source === rel.target) continue;
      const pts = rel._route!;
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
    computeRoutes(model);
    for (const rel of model.relationships) {
      if (rel.source === rel.target) continue;
      const pts = rel._route!;
      const { p1, p2 } = edgeEndpoints(model, rel); // after routing — slots may have been reordered
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
    computeRoutes(model);
    for (const rel of model.relationships) {
      const pts = rel._route;
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

  it('nulls the route of a self-loop', () => {
    const model = buildModel();
    const self = model.relById.get('self')!;
    self._route = [{ x: 0, y: 0 }]; // stale garbage that must be cleared
    computeRoutes(model);
    expect(self._route).toBeNull();
  });
});
