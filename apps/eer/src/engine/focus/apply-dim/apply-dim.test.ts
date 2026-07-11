import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../../test/scene';
import { applyDim } from './apply-dim';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

describe('applyDim', () => {
  it('lights related cards with focus and dims everything else', () => {
    state = makeScene();
    applyDim(state, new Set(['users', 'orders']), new Set(['u-o']));
    expect(state.els.cards.get('users')!.classList.contains('focus')).toBe(true);
    expect(state.els.cards.get('users')!.classList.contains('dim')).toBe(false);
    expect(state.els.cards.get('orders')!.classList.contains('focus')).toBe(true);
    expect(state.els.cards.get('tags')!.classList.contains('dim')).toBe(true);
    expect(state.els.cards.get('tags')!.classList.contains('focus')).toBe(false);
  });

  it('activates related edges and dims the rest', () => {
    state = makeScene();
    applyDim(state, new Set(['users', 'orders']), new Set(['u-o']));
    expect(state.els.edgeEls.get('u-o')!.g.classList.contains('active')).toBe(true);
    expect(state.els.edgeEls.get('u-o')!.g.classList.contains('dim')).toBe(false);
    expect(state.els.edgeEls.get('t-o')!.g.classList.contains('dim')).toBe(true);
    expect(state.els.edgeEls.get('t-o')!.g.classList.contains('active')).toBe(false);
    expect(state.els.edgeEls.get('self')!.g.classList.contains('dim')).toBe(true);
  });

  it('removes edge-top from the svg and stale selected/hot classes', () => {
    state = makeScene();
    state.els.svg.classList.add('edge-top');
    state.els.cards.get('users')!.classList.add('selected');
    state.els.edgeEls.get('t-o')!.g.classList.add('hot');
    applyDim(state, new Set(['users']), new Set());
    expect(state.els.svg.classList.contains('edge-top')).toBe(false);
    expect(state.els.cards.get('users')!.classList.contains('selected')).toBe(false);
    expect(state.els.edgeEls.get('t-o')!.g.classList.contains('hot')).toBe(false);
  });
});
