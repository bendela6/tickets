import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../../test/scene';
import { entityColor } from '../entity-color';
import { GROUP_PALETTE } from '../group-color';
import { edgeColor } from './edge-color';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

describe('edgeColor', () => {
  it('returns the entity color from the state model for every entity', () => {
    state = makeScene();
    for (const e of state.model.entities) {
      expect(edgeColor(state, e.id)).toBe(entityColor(state.model, e.id));
    }
  });

  it('colors each built edge group with its FK-side (target) entity color', () => {
    state = makeScene();
    for (const rel of state.model.relationships) {
      const g = state.els.edgeEls.get(rel.id)!.g;
      expect(g.style.getPropertyValue('--edge-c')).toBe(edgeColor(state, rel.target));
    }
  });

  it('falls back to the first palette entry for an unknown id', () => {
    state = makeScene();
    expect(edgeColor(state, 'no-such-entity')).toBe(GROUP_PALETTE[0]);
  });
});
