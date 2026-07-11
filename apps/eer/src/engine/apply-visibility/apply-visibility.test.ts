import { afterEach, describe, expect, it } from 'vitest';

import { nestedRaw } from '../../test/models';
import { cleanupScene, makeScene } from '../../test/scene';
import { applyVisibility } from './apply-visibility';
import type { EngineState } from '../types';

let state: EngineState;
afterEach(() => cleanupScene(state));

const cardHidden = (id: string) => state.els.cards.get(id)!.classList.contains('hidden');
const edgeHidden = (id: string) => state.els.edgeEls.get(id)!.g.classList.contains('hidden');
const boxHidden = (id: string) => {
  const z = [...state.els.groupLayer.children].find((c) => (c as HTMLElement).dataset.group === id)!;
  return z.classList.contains('hidden');
};

describe('applyVisibility', () => {
  it('hiding a zone hides its cards, its box, and every edge touching it', () => {
    state = makeScene();
    state.hidden.groups.add('z2');
    applyVisibility(state);
    expect(cardHidden('orders')).toBe(true);
    expect(cardHidden('tags')).toBe(true);
    expect(cardHidden('users')).toBe(false);
    expect(boxHidden('z2')).toBe(true);
    expect(boxHidden('z1')).toBe(false);
    expect(edgeHidden('u-o')).toBe(true); // touches orders in z2
    expect(edgeHidden('t-o')).toBe(true); // fully inside z2
    expect(edgeHidden('self')).toBe(false); // users-only, z1
  });

  it('unhiding the zone restores cards, box, and edges', () => {
    state = makeScene();
    state.hidden.groups.add('z2');
    applyVisibility(state);
    state.hidden.groups.delete('z2');
    applyVisibility(state);
    for (const id of ['users', 'orders', 'tags']) expect(cardHidden(id)).toBe(false);
    for (const id of ['u-o', 't-o', 'self']) expect(edgeHidden(id)).toBe(false);
    expect(boxHidden('z2')).toBe(false);
  });

  it('hiding a zone also hides its subgroup box and member cards', () => {
    state = makeScene(nestedRaw());
    state.hidden.groups.add('z'); // subgroup 's' resolves to zone 'z'
    applyVisibility(state);
    expect(cardHidden('loose')).toBe(true);
    expect(cardHidden('m1')).toBe(true);
    expect(cardHidden('m2')).toBe(true);
    expect(boxHidden('z')).toBe(true);
    expect(boxHidden('s')).toBe(true);
    expect(edgeHidden('m1-m2')).toBe(true);
  });

  it('hiding a kind hides edges of that kind but leaves cards visible', () => {
    state = makeScene();
    state.hidden.kinds.add('fk'); // all three fixture edges are kind fk
    applyVisibility(state);
    for (const id of ['u-o', 't-o', 'self']) expect(edgeHidden(id)).toBe(true);
    for (const id of ['users', 'orders', 'tags']) expect(cardHidden(id)).toBe(false);
    state.hidden.kinds.delete('fk');
    applyVisibility(state);
    for (const id of ['u-o', 't-o', 'self']) expect(edgeHidden(id)).toBe(false);
  });
});
