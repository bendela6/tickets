import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../../test/scene';
import { applyTransform } from './apply-transform';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

describe('applyTransform', () => {
  it('writes the view pan/zoom onto the world transform', () => {
    state = makeScene();
    state.view.panX = 12;
    state.view.panY = -34;
    state.view.zoom = 1.5;
    applyTransform(state);
    expect(state.els.world.style.transform).toBe('translate(12px, -34px) scale(1.5)');
  });

  it('tracks subsequent view changes', () => {
    state = makeScene();
    state.view.panX = 0;
    state.view.panY = 0;
    state.view.zoom = 1;
    applyTransform(state);
    expect(state.els.world.style.transform).toBe('translate(0px, 0px) scale(1)');
    state.view.panX = 100.5;
    state.view.zoom = 0.25;
    applyTransform(state);
    expect(state.els.world.style.transform).toBe('translate(100.5px, 0px) scale(0.25)');
  });
});
