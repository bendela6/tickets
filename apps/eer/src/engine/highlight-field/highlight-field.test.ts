import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../test/scene';
import { highlightField } from './highlight-field';
import type { EngineState } from '../types';

let state: EngineState;
afterEach(() => cleanupScene(state));

const hot = (id: string) => state.els.edgeEls.get(id)!.g.classList.contains('hot');

describe('highlightField', () => {
  it('marks hot exactly the edges attached on the source side of the field', () => {
    state = makeScene();
    highlightField(state, 'users', 'id'); // source of both u-o and self
    expect(hot('u-o')).toBe(true);
    expect(hot('self')).toBe(true);
    expect(hot('t-o')).toBe(false);
  });

  it('matches target-side attachments too', () => {
    state = makeScene();
    highlightField(state, 'orders', 'tag_id'); // target of t-o only
    expect(hot('t-o')).toBe(true);
    expect(hot('u-o')).toBe(false);
    expect(hot('self')).toBe(false);
  });

  it('clears a previous highlight when the new field has no edges', () => {
    state = makeScene();
    highlightField(state, 'users', 'id');
    highlightField(state, 'users', 'name'); // plain column, no relationships
    expect(hot('u-o')).toBe(false);
    expect(hot('t-o')).toBe(false);
    expect(hot('self')).toBe(false);
  });
});
