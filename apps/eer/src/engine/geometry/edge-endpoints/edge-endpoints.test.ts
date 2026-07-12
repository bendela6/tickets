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

  it('adds the pin slot offsets to the endpoint ys (x untouched)', () => {
    const model = buildModel();
    const rel = model.relById.get('u-o')!;
    const bare = edgeEndpoints(model, rel);
    rel._srcSlot = 6;
    rel._tgtSlot = -4;
    const fanned = edgeEndpoints(model, rel);
    expect(fanned.p1).toEqual({ x: bare.p1.x, y: bare.p1.y + 6 });
    expect(fanned.p2).toEqual({ x: bare.p2.x, y: bare.p2.y - 4 });
  });

  it('applies explicit slot offsets over the rel fields', () => {
    const model = buildModel();
    const rel = model.relById.get('u-o')!;
    const base = edgeEndpoints(model, rel, { src: 0, tgt: 0 });
    const fanned = edgeEndpoints(model, rel, { src: 4, tgt: -4 });
    expect(fanned.p1.y).toBe(base.p1.y + 4);
    expect(fanned.p2.y).toBe(base.p2.y - 4);
  });

  it('flags a self-loop and returns the same entity at both ends', () => {
    const model = buildModel();
    const ends = edgeEndpoints(model, model.relById.get('self')!);
    expect(ends.self).toBe(true);
    expect(ends.A).toBe(ends.B);
  });
});
