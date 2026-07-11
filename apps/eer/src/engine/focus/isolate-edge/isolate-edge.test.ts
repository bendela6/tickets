import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../../test/scene';
import { isolateEdge } from './isolate-edge';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

describe('isolateEdge', () => {
  it('keeps only the two endpoint cards lit and dims the rest', () => {
    state = makeScene();
    isolateEdge(state, 'u-o');
    expect(state.els.cards.get('users')!.classList.contains('focus')).toBe(true);
    expect(state.els.cards.get('orders')!.classList.contains('focus')).toBe(true);
    expect(state.els.cards.get('tags')!.classList.contains('dim')).toBe(true);
    expect(state.els.edgeEls.get('u-o')!.g.classList.contains('active')).toBe(true);
    expect(state.els.edgeEls.get('t-o')!.g.classList.contains('dim')).toBe(true);
    expect(state.focus).toEqual({ type: 'edge', id: 'u-o' });
  });

  it('lifts the edge layer above the cards and raises the edge to the top of the svg', () => {
    state = makeScene();
    const g = state.els.edgeEls.get('u-o')!.g;
    expect(state.els.svg.lastElementChild).not.toBe(g); // built first, so not last initially
    isolateEdge(state, 'u-o');
    expect(state.els.svg.classList.contains('edge-top')).toBe(true);
    expect(state.els.svg.lastElementChild).toBe(g);
  });

  it('ignores an unknown relationship id', () => {
    state = makeScene();
    isolateEdge(state, 'nope');
    expect(state.focus).toBeNull();
    expect(state.els.svg.classList.contains('edge-top')).toBe(false);
    expect(state.els.cards.get('tags')!.classList.contains('dim')).toBe(false);
  });
});
