import { afterEach, describe, expect, it } from 'vitest';

import { fkTo, pkField } from '../../../test/models';
import { cleanupScene, makeScene } from '../../../test/scene';
import { drawAllEdges } from './draw-all-edges';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

// Two parallel edges between the same two ports → both pins fan (_pinSpan > 0).
function fannedRaw() {
  return {
    view: { routing: 'avoid' },
    groups: [{ id: 'z', label: 'Zone', order: 0 }],
    entities: [
      { id: 'users', group: 'z', fields: [pkField] },
      { id: 'orders', group: 'z', fields: [pkField, fkTo('users')] },
    ],
    relationships: [
      { id: 'r1', source: 'users', sourceField: 'id', target: 'orders', targetField: 'users_id' },
      { id: 'r2', source: 'users', sourceField: 'id', target: 'orders', targetField: 'users_id' },
    ],
  };
}

describe('drawAllEdges', () => {
  it('writes a d to every edge element', () => {
    state = makeScene();
    for (const els of state.els.edgeEls.values()) {
      for (const el of [els.path, els.casing, els.hit]) el.setAttribute('d', '');
    }
    drawAllEdges(state);
    for (const [id, els] of state.els.edgeEls) {
      expect(els.path.getAttribute('d'), id).not.toBe('');
      expect(els.casing.getAttribute('d'), id).not.toBe('');
      expect(els.hit.getAttribute('d'), id).not.toBe('');
    }
  });

  it('sizes fanned pin bars with an inline height', () => {
    state = makeScene(fannedRaw());
    // n=2 connections on each shared port → span 4 → height 2*4 + 11 = 19px
    const userPorts = [...state.els.cards.get('users')!.querySelectorAll('.port[data-field="id"]')] as HTMLElement[];
    const sized = userPorts.filter((p) => p.style.height !== '');
    expect(sized.length).toBe(1); // only the side the fan exits from
    expect(sized[0]!.style.height).toBe('19px');
    const orderPorts = [
      ...state.els.cards.get('orders')!.querySelectorAll('.port[data-field="users_id"]'),
    ] as HTMLElement[];
    expect(orderPorts.some((p) => p.style.height === '19px')).toBe(true);
  });

  it('clears the inline height once a pin stops fanning', () => {
    state = makeScene(fannedRaw());
    state.model.relationships = state.model.relationships.filter((r) => r.id !== 'r2');
    drawAllEdges(state);
    const ports = [...state.els.cardLayer.querySelectorAll('.port')] as HTMLElement[];
    expect(ports.every((p) => p.style.height === '')).toBe(true);
  });

  it('does not recompute routes on a live pass, but still redraws', () => {
    state = makeScene();
    const rel = state.model.relById.get('u-o')!;
    const routeBefore = JSON.parse(JSON.stringify(rel._route));
    const dBefore = state.els.edgeEls.get('u-o')!.path.getAttribute('d');
    state.model.entityById.get('users')!.x += 80;
    drawAllEdges(state, true);
    expect(rel._route).toEqual(routeBefore); // stale route untouched
    expect(state.els.edgeEls.get('u-o')!.path.getAttribute('d')).not.toBe(dBefore); // cheap shape moved
  });
});
