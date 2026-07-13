import { describe, it, expect } from 'vitest';
import { buildModel } from '../../../test/models';
import { isolatedEdge } from './isolated-edge';

describe('isolatedEdge', () => {
  it('just the two endpoints and the edge; unknown rel → empty', () => {
    const model = buildModel();
    expect(isolatedEdge(model, 'rel:orders:c2')).toEqual({ entities: new Set(['users', 'orders']), edges: new Set(['rel:orders:c2']) });
    expect(isolatedEdge(model, 'nope').edges.size).toBe(0);
  });
});
