import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../test/scene';
import { positionEntity } from './position-entity';
import type { EngineState } from '../types';

let state: EngineState;
afterEach(() => cleanupScene(state));

describe('positionEntity', () => {
  it('moves the card transform to the entity coordinates', () => {
    state = makeScene();
    const e = state.model.entityById.get('users')!;
    e.x = 123;
    e.y = 456;
    positionEntity(state, 'users');
    expect(state.els.cards.get('users')!.style.transform).toBe('translate(123px, 456px)');
  });

  it('leaves other cards untouched', () => {
    state = makeScene();
    const before = state.els.cards.get('tags')!.style.transform;
    state.model.entityById.get('users')!.x += 50;
    positionEntity(state, 'users');
    expect(state.els.cards.get('tags')!.style.transform).toBe(before);
  });

  it('tracks repeated coordinate changes, including fractions and zero', () => {
    state = makeScene();
    const e = state.model.entityById.get('orders')!;
    e.x = 10;
    e.y = 20;
    positionEntity(state, 'orders');
    expect(state.els.cards.get('orders')!.style.transform).toBe('translate(10px, 20px)');
    e.x = -5.5;
    e.y = 0;
    positionEntity(state, 'orders');
    expect(state.els.cards.get('orders')!.style.transform).toBe('translate(-5.5px, 0px)');
  });
});
