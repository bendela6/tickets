import { describe, it, expect } from 'vitest';
import { buildModel } from '../../../test/models';
import { connectedPorts } from './connected-ports';

describe('connectedPorts', () => {
  it('one-ends of visible edges are connected; hidden edges are not', () => {
    const model = buildModel();
    const all = connectedPorts(model, new Set());
    expect(all.size).toBeGreaterThan(0); // u-o & self: users.id side is the one-end
    const none = connectedPorts(model, new Set(model.relationships.map((r) => r.id)));
    expect(none.size).toBe(0);
  });
});
