import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../../test/scene';
import { drawEdgesForEntity } from './draw-edges-for-entity';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

function blankAllPaths(s: EngineState): void {
  for (const els of s.els.edgeEls.values()) els.path.setAttribute('d', '');
}

describe('drawEdgesForEntity', () => {
  it('redraws only the edges touching the entity', () => {
    state = makeScene();
    blankAllPaths(state);
    drawEdgesForEntity(state, 'users');
    expect(state.els.edgeEls.get('u-o')!.path.getAttribute('d')).not.toBe(''); // users is source
    expect(state.els.edgeEls.get('self')!.path.getAttribute('d')).not.toBe(''); // self-loop on users
    expect(state.els.edgeEls.get('t-o')!.path.getAttribute('d')).toBe(''); // untouched
  });

  it('catches edges where the entity is the target', () => {
    state = makeScene();
    blankAllPaths(state);
    drawEdgesForEntity(state, 'orders');
    expect(state.els.edgeEls.get('u-o')!.path.getAttribute('d')).not.toBe('');
    expect(state.els.edgeEls.get('t-o')!.path.getAttribute('d')).not.toBe('');
    expect(state.els.edgeEls.get('self')!.path.getAttribute('d')).toBe('');
  });

  it('refreshes connected-port markings', () => {
    state = makeScene();
    for (const p of state.els.cardLayer.querySelectorAll('.port.connected')) p.classList.remove('connected');
    drawEdgesForEntity(state, 'users');
    expect(state.els.cardLayer.querySelectorAll('.port.connected').length).toBeGreaterThan(0);
  });
});
