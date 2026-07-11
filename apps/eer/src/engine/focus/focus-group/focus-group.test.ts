import { afterEach, describe, expect, it } from 'vitest';

import { nestedRaw } from '../../../test/models';
import { cleanupScene, makeScene } from '../../../test/scene';
import { focusGroup } from './focus-group';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

function zoneEl(s: EngineState, id: string): HTMLElement {
  const z = [...s.els.groupLayer.children].find((c) => (c as HTMLElement).dataset.group === id);
  if (!z) throw new Error('no zone element for ' + id);
  return z as HTMLElement;
}

describe('focusGroup', () => {
  it('focusing a subgroup selects its box, lights its members, and dims the other boxes', () => {
    state = makeScene(nestedRaw());
    focusGroup(state, 's');
    expect(zoneEl(state, 's').classList.contains('zone-selected')).toBe(true);
    expect(zoneEl(state, 's').classList.contains('zone-dim')).toBe(false);
    expect(zoneEl(state, 'z').classList.contains('zone-dim')).toBe(true);
    expect(state.els.cards.get('m1')!.classList.contains('focus')).toBe(true);
    expect(state.els.cards.get('m2')!.classList.contains('focus')).toBe(true);
    expect(state.els.cards.get('loose')!.classList.contains('dim')).toBe(true);
    expect(state.els.edgeEls.get('m1-m2')!.g.classList.contains('active')).toBe(true);
    expect(state.focus).toEqual({ type: 'group', id: 's' });
  });

  it('focusing a zone keeps its subgroup box lit and lights every member card', () => {
    state = makeScene(nestedRaw());
    focusGroup(state, 'z');
    expect(zoneEl(state, 'z').classList.contains('zone-selected')).toBe(true);
    expect(zoneEl(state, 's').classList.contains('zone-dim')).toBe(false);
    expect(zoneEl(state, 's').classList.contains('zone-selected')).toBe(false);
    for (const id of ['loose', 'm1', 'm2']) {
      expect(state.els.cards.get(id)!.classList.contains('focus')).toBe(true);
      expect(state.els.cards.get(id)!.classList.contains('dim')).toBe(false);
    }
    expect(state.focus).toEqual({ type: 'group', id: 'z' });
  });

  it('keeps entities connected from outside the group lit, and their edges active', () => {
    state = makeScene(); // z1 holds users; orders (z2) connects via u-o
    focusGroup(state, 'z1');
    expect(state.els.cards.get('orders')!.classList.contains('focus')).toBe(true);
    expect(state.els.cards.get('tags')!.classList.contains('dim')).toBe(true);
    expect(state.els.edgeEls.get('u-o')!.g.classList.contains('active')).toBe(true);
    expect(state.els.edgeEls.get('self')!.g.classList.contains('active')).toBe(true);
    expect(state.els.edgeEls.get('t-o')!.g.classList.contains('dim')).toBe(true);
  });
});
