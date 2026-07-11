import { describe, expect, it } from 'vitest';

import { buildModel } from '../../test/models';
import { edgeSides } from './edge-sides';

describe('edgeSides', () => {
  const model = buildModel(); // z1: users | z2: orders above tags

  it('picks facing sides for side-by-side cards in different zones', () => {
    // users (left zone) → orders (right zone): exit right, enter left.
    expect(edgeSides(model, model.relById.get('u-o')!)).toEqual({ s: 'R', t: 'L' });
  });

  it('uses the SAME side for cards stacked in one column (no wrap-around)', () => {
    const orders = model.entityById.get('orders')!;
    const tags = model.entityById.get('tags')!;
    expect(tags.x).toBe(orders.x); // fixture precondition: one column in z2
    const { s, t } = edgeSides(model, model.relById.get('t-o')!);
    expect(s).toBe(t);
  });

  it('routes a self-loop out and back on the right', () => {
    expect(edgeSides(model, model.relById.get('self')!)).toEqual({ s: 'R', t: 'R' });
  });
});
