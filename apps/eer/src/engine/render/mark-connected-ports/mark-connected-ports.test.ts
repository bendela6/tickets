import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../../test/scene';
import { markConnectedPorts } from './mark-connected-ports';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

function connectedKeys(s: EngineState): string[] {
  return [...s.els.cardLayer.querySelectorAll('.port.connected')].map((p) => {
    const el = p as HTMLElement;
    return `${el.dataset.entity}.${el.dataset.field}`;
  });
}

describe('markConnectedPorts', () => {
  it('marks only the ports at the one ends of visible edges', () => {
    state = makeScene();
    markConnectedPorts(state);
    const keys = connectedKeys(state);
    // All three fixture rels are 1-n: one ends are users.id (u-o, self) and tags.id (t-o).
    expect(keys).toContain('users.id');
    expect(keys).toContain('tags.id');
    // Never the fk (many) ends: orders.users_id, orders.tag_id, users.manager_id.
    expect(keys.every((k) => k === 'users.id' || k === 'tags.id')).toBe(true);
  });

  it('marks the connecting side of the field, not both ports', () => {
    state = makeScene();
    markConnectedPorts(state);
    // tags.id carries exactly one edge end → exactly one of its two ports lights up
    expect(state.els.cards.get('tags')!.querySelectorAll('.port.connected').length).toBe(1);
  });

  it('drops the marking for edges hidden since the last pass', () => {
    state = makeScene();
    markConnectedPorts(state);
    expect(connectedKeys(state)).toContain('tags.id');
    state.els.edgeEls.get('t-o')!.g.classList.add('hidden');
    markConnectedPorts(state);
    const keys = connectedKeys(state);
    expect(keys).not.toContain('tags.id');
    expect(keys).toContain('users.id'); // unaffected edges keep their marking
  });
});
