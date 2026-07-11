import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../../test/scene';
import { focusEntity } from '../focus-entity';
import { focusGroup } from '../focus-group';
import { isolateEdge } from '../isolate-edge';
import { clearFocus } from './clear-focus';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

describe('clearFocus', () => {
  it('removes dim/focus/selected from cards and dim/active from edges after an entity focus', () => {
    state = makeScene();
    focusEntity(state, 'users');
    clearFocus(state);
    for (const [, card] of state.els.cards) {
      expect(card.classList.contains('dim')).toBe(false);
      expect(card.classList.contains('focus')).toBe(false);
      expect(card.classList.contains('selected')).toBe(false);
    }
    for (const [, els] of state.els.edgeEls) {
      expect(els.g.classList.contains('dim')).toBe(false);
      expect(els.g.classList.contains('active')).toBe(false);
      expect(els.g.classList.contains('hot')).toBe(false);
    }
    expect(state.focus).toBeNull();
  });

  it('removes zone-selected/zone-dim from group boxes after a group focus', () => {
    state = makeScene();
    focusGroup(state, 'z1');
    clearFocus(state);
    for (const z of state.els.groupLayer.children) {
      expect(z.classList.contains('zone-selected')).toBe(false);
      expect(z.classList.contains('zone-dim')).toBe(false);
    }
    expect(state.focus).toBeNull();
  });

  it('drops edge-top and the edge focus after an edge isolate', () => {
    state = makeScene();
    isolateEdge(state, 'u-o');
    expect(state.els.svg.classList.contains('edge-top')).toBe(true);
    clearFocus(state);
    expect(state.els.svg.classList.contains('edge-top')).toBe(false);
    expect(state.focus).toBeNull();
  });
});
