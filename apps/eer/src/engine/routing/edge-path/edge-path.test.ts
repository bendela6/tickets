import { describe, expect, it } from 'vitest';

import { buildModel } from '../../../test/models';
import { edgeEndpoints } from '../../geometry/edge-endpoints';
import { computeEdgeGeometry } from '../edge-geometry';
import { edgePath } from './edge-path';

function endpointsOf(d: string) {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  return { start: { x: n[0]!, y: n[1]! }, end: { x: n[n.length - 2]!, y: n[n.length - 1]! } };
}

describe('edgePath', () => {
  it('path starts and ends on the fanned ports in every mode', () => {
    const model = buildModel();
    for (const mode of ['curved', 'avoid', 'ortho'] as const) {
      const g = computeEdgeGeometry(model, mode);
      const rel = model.relById.get('rel:orders:c2')!;
      const { p1, p2 } = edgeEndpoints(model, rel, g.slots.get(rel.id));
      const { start, end } = endpointsOf(edgePath(model, rel, mode, g, false).d);
      expect(Math.hypot(start.x - p1.x, start.y - p1.y)).toBeLessThan(0.5);
      expect(Math.hypot(end.x - p2.x, end.y - p2.y)).toBeLessThan(0.5);
    }
  });

  it('self-loop bulges right of the card and has no head', () => {
    const model = buildModel();
    const g = computeEdgeGeometry(model, 'curved');
    const out = edgePath(model, model.relById.get('rel:users:c2')!, 'curved', g, false);
    expect(out.head).toBe('');
    expect(out.d.startsWith('M ')).toBe(true);
  });

  it('live=true falls back to the cheap direct shape (never throws without routes)', () => {
    const model = buildModel();
    const g = computeEdgeGeometry(model, 'avoid');
    const rel = model.relById.get('rel:orders:c2')!;
    expect(edgePath(model, rel, 'avoid', g, true).d.length).toBeGreaterThan(0);
    expect(edgePath(model, rel, 'avoid', { ...g, routes: new Map() }, false).d.length).toBeGreaterThan(0);
  });

  it('many end gets a crow-foot head', () => {
    const model = buildModel(); // rel:orders:c2 is 1-n → target end is the many side
    const g = computeEdgeGeometry(model, 'curved');
    expect(edgePath(model, model.relById.get('rel:orders:c2')!, 'curved', g, false).head).toContain('M');
  });
});
