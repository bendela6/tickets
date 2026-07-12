import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../../test/scene';
import { entityColor } from '../entity-color';
import { GROUP_PALETTE } from '../group-color';
import { edgeColor } from './edge-color';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

describe('edgeColor', () => {
  it('returns the entity color from the model for every entity', () => {
    state = makeScene();
    for (const e of state.model.entities) {
      expect(edgeColor(state.model, e.id)).toBe(entityColor(state.model, e.id));
    }
  });

  it('applies overrides when provided', () => {
    state = makeScene();
    const entity = state.model.entities[0]!;
    const overrides = new Map([[entity.id, '#ff0000']]);
    expect(edgeColor(state.model, entity.id, overrides)).toBe(entityColor(state.model, entity.id, overrides));
  });

  it('falls back to the first palette entry for an unknown id', () => {
    state = makeScene();
    expect(edgeColor(state.model, 'no-such-entity')).toBe(GROUP_PALETTE[0]);
  });
});
