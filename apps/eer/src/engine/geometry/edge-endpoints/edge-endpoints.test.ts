import { describe, expect, it } from 'vitest';

import { buildModel } from '../../../test/models';
import { edgeSides } from '../edge-sides';
import { fieldIndex } from '../field-index';
import { portWorldPos } from '../port-world-pos';
import { edgeEndpoints } from './edge-endpoints';

describe('edgeEndpoints', () => {
  it('lands both endpoints exactly on the ports of the resolved sides', () => {
    const model = buildModel();
    const rel = model.relById.get('u-o')!;
    const users = model.entityById.get('users')!;
    const orders = model.entityById.get('orders')!;
    const { s, t } = edgeSides(model, rel);

    const ends = edgeEndpoints(model, rel);
    expect(ends).toMatchObject({ s, t, self: false, A: users, B: orders });
    expect(ends.p1).toEqual(portWorldPos(users, fieldIndex(users, 'id'), s));
    expect(ends.p2).toEqual(portWorldPos(orders, fieldIndex(orders, 'users_id'), t));
  });

  it('defaults to a zero offset when no slot is given', () => {
    const model = buildModel();
    const rel = model.relById.get('u-o')!;
    const bare = edgeEndpoints(model, rel);
    const zeroed = edgeEndpoints(model, rel, { src: 0, tgt: 0 });
    expect(bare.p1).toEqual(zeroed.p1);
    expect(bare.p2).toEqual(zeroed.p2);
  });

  it('applies explicit slot offsets to the endpoint ys (x untouched)', () => {
    const model = buildModel();
    const rel = model.relById.get('u-o')!;
    const base = edgeEndpoints(model, rel, { src: 0, tgt: 0 });
    const fanned = edgeEndpoints(model, rel, { src: 4, tgt: -4 });
    expect(fanned.p1).toEqual({ x: base.p1.x, y: base.p1.y + 4 });
    expect(fanned.p2).toEqual({ x: base.p2.x, y: base.p2.y - 4 });
  });

  it('flags a self-loop and returns the same entity at both ends', () => {
    const model = buildModel();
    const ends = edgeEndpoints(model, model.relById.get('self')!);
    expect(ends.self).toBe(true);
    expect(ends.A).toBe(ends.B);
  });
});
