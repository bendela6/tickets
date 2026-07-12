import { describe, it, expect } from 'vitest';
import { buildModel } from '../../../test/models';
import { isolatedEdge } from './isolated-edge';

describe('isolatedEdge', () => {
  it('just the two endpoints and the edge; unknown rel → empty', () => {
    const model = buildModel();
    expect(isolatedEdge(model, 'u-o')).toEqual({ entities: new Set(['users', 'orders']), edges: new Set(['u-o']) });
    expect(isolatedEdge(model, 'nope').edges.size).toBe(0);
  });
});
