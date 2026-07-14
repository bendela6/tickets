import { describe, expect, it } from 'vitest';

import { buildModel } from '../../../test/models';
import { computeEdgeGeometry } from './edge-geometry';

describe('computeEdgeGeometry', () => {
  it('curved mode: slots + spans, no routes', () => {
    const g = computeEdgeGeometry(buildModel(), 'curved');
    expect(g.routes.size).toBe(0);
    expect(g.slots.size).toBe(3);
  });

  it('avoid mode: a route per non-self relationship, self is null', () => {
    const model = buildModel();
    const g = computeEdgeGeometry(model, 'avoid');
    expect(g.routes.get('rel:orders:c2')).toBeTruthy();
    expect(g.routes.get('rel:users:c2')).toBeNull();
  });

  it('is pure: the model is untouched', () => {
    const model = buildModel();
    const before = JSON.stringify(model, (_, v: unknown) => (v instanceof Map ? [...v] : v));
    computeEdgeGeometry(model, 'avoid');
    expect(JSON.stringify(model, (_, v: unknown) => (v instanceof Map ? [...v] : v))).toBe(before);
  });
});
