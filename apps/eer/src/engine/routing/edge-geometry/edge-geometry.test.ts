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
    expect(g.routes.get('u-o')).toBeTruthy();
    expect(g.routes.get('self')).toBeNull();
    expect(model._pinSpan).toBeUndefined(); // pure: model untouched
  });
});
