import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../test/scene';
import { focusEntity } from './focus-entity';
import type { EngineState } from '../types';

let state: EngineState;
afterEach(() => cleanupScene(state));

describe('focusEntity', () => {
  it('selects the entity, keeps neighbours lit, dims the rest', () => {
    state = makeScene();
    focusEntity(state, 'users');
    expect(state.els.cards.get('users')!.classList.contains('selected')).toBe(true);
    expect(state.els.cards.get('orders')!.classList.contains('focus')).toBe(true); // connected via u-o
    expect(state.els.cards.get('tags')!.classList.contains('dim')).toBe(true); // unrelated
    expect(state.els.edgeEls.get('u-o')!.g.classList.contains('active')).toBe(true);
    expect(state.els.edgeEls.get('t-o')!.g.classList.contains('dim')).toBe(true);
    expect(state.focus).toEqual({ type: 'entity', id: 'users' });
  });

  it('includes self-loops in the lit edge set', () => {
    state = makeScene();
    focusEntity(state, 'users');
    expect(state.els.edgeEls.get('self')!.g.classList.contains('active')).toBe(true);
  });
});
