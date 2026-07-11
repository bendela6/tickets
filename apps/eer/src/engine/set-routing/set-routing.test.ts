import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../test/scene';
import { setRouting } from './set-routing';
import type { EngineState } from '../types';

let state: EngineState;
afterEach(() => cleanupScene(state));

const d = (id: string) => state.els.edgeEls.get(id)!.path.getAttribute('d') ?? '';

describe('setRouting', () => {
  it('switching to curved updates the view state and writes cubic curves', () => {
    state = makeScene(); // fixture starts in avoid mode
    setRouting(state, 'curved');
    expect(state.view.routing).toBe('curved');
    for (const id of ['u-o', 't-o']) {
      expect(d(id)).toMatch(/^M /);
      expect(d(id)).toContain('C');
    }
  });

  it('switching to ortho writes only M/L segments for normal edges', () => {
    state = makeScene();
    setRouting(state, 'ortho');
    expect(state.view.routing).toBe('ortho');
    for (const id of ['u-o', 't-o']) {
      expect(d(id)).toMatch(/^M /);
      expect(d(id)).toContain('L');
      expect(d(id)).not.toContain('C');
    }
  });

  it('repopulates the d attribute on every edge layer (path, casing, hit)', () => {
    state = makeScene();
    setRouting(state, 'curved');
    setRouting(state, 'avoid');
    for (const [, els] of state.els.edgeEls) {
      const path = els.path.getAttribute('d');
      expect(path).toBeTruthy();
      expect(els.casing.getAttribute('d')).toBe(path);
      expect(els.hit.getAttribute('d')).toBe(path);
    }
  });
});
