import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../../test/scene';
import { raiseEdge } from './raise-edge';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

describe('raiseEdge', () => {
  it('re-appends the edge group so it becomes the last svg child (moved, not cloned)', () => {
    state = makeScene();
    const g = state.els.edgeEls.get('u-o')!.g;
    expect(state.els.svg.lastElementChild).not.toBe(g); // 'u-o' is built first
    raiseEdge(state, 'u-o');
    expect(state.els.svg.lastElementChild).toBe(g);
    expect(state.els.svg.querySelectorAll('g.edge')).toHaveLength(3);
  });

  it('keeps an already-raised edge on top when raised again', () => {
    state = makeScene();
    raiseEdge(state, 't-o');
    raiseEdge(state, 't-o');
    expect(state.els.svg.lastElementChild).toBe(state.els.edgeEls.get('t-o')!.g);
    expect(state.els.svg.querySelectorAll('g.edge')).toHaveLength(3);
  });

  it('does nothing for an unknown relationship id', () => {
    state = makeScene();
    const last = state.els.svg.lastElementChild;
    raiseEdge(state, 'nope');
    expect(state.els.svg.lastElementChild).toBe(last);
  });
});
