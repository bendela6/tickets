import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../test/scene';
import { highlightField } from '../highlight-field';
import { isolateEdge } from '../isolate-edge';
import { clearFieldHighlight } from './clear-field-highlight';
import type { EngineState } from '../types';

let state: EngineState;
afterEach(() => cleanupScene(state));

const hot = (id: string) => state.els.edgeEls.get(id)!.g.classList.contains('hot');

describe('clearFieldHighlight', () => {
  it('removes hot from every edge', () => {
    state = makeScene();
    highlightField(state, 'users', 'id');
    expect(hot('u-o')).toBe(true);
    clearFieldHighlight(state);
    expect(hot('u-o')).toBe(false);
    expect(hot('t-o')).toBe(false);
    expect(hot('self')).toBe(false);
  });

  it('keeps an isolated edge hot while clearing the others', () => {
    state = makeScene();
    isolateEdge(state, 'u-o'); // focus = { type: 'edge', id: 'u-o' }
    state.els.edgeEls.get('u-o')!.g.classList.add('hot'); // hover on the isolated edge
    state.els.edgeEls.get('t-o')!.g.classList.add('hot');
    clearFieldHighlight(state);
    expect(hot('u-o')).toBe(true);
    expect(hot('t-o')).toBe(false);
  });

  it('clears the previously-isolated edge once the focus moves elsewhere', () => {
    state = makeScene();
    state.els.edgeEls.get('u-o')!.g.classList.add('hot');
    state.focus = { type: 'entity', id: 'users' }; // not an edge focus
    clearFieldHighlight(state);
    expect(hot('u-o')).toBe(false);
  });
});
