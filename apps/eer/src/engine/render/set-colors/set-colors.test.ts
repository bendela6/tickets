import { afterEach, describe, expect, it } from 'vitest';

import { nestedRaw } from '../../../test/models';
import { cleanupScene, makeScene } from '../../../test/scene';
import { GROUP_PALETTE } from '../../colors/group-color';
import { setColors } from './set-colors';
import type { EngineState } from '../../model/types';

let state: EngineState;
afterEach(() => cleanupScene(state));

const zoneEl = (id: string) => state.els.groupLayer.querySelector(`.zone[data-group="${id}"]`) as HTMLElement;

describe('setColors', () => {
  it('a group override restamps the zone, its subgroups and its tables', () => {
    state = makeScene(nestedRaw());
    setColors(state, new Map([['z', '#123456']]));
    expect(zoneEl('z').style.getPropertyValue('--group-c')).toBe('#123456');
    expect(zoneEl('s').style.getPropertyValue('--group-c')).toBe('#123456');
    for (const id of ['loose', 'm1', 'm2']) {
      expect(state.els.cards.get(id)!.style.getPropertyValue('--entity-c')).toBe('#123456');
    }
  });

  it('an entity override survives a group override', () => {
    state = makeScene(nestedRaw());
    setColors(
      state,
      new Map([
        ['z', '#123456'],
        ['m1', '#abcdef'],
      ]),
    );
    expect(state.els.cards.get('m1')!.style.getPropertyValue('--entity-c')).toBe('#abcdef');
    expect(state.els.cards.get('m2')!.style.getPropertyValue('--entity-c')).toBe('#123456');
  });

  it('restamps edges from their FK-side entity override', () => {
    state = makeScene(nestedRaw());
    setColors(state, new Map([['m2', '#abcdef']]));
    // m1-m2 targets m2 (holder of the fk), so the edge follows m2's override.
    expect(state.els.edgeEls.get('m1-m2')!.g.style.getPropertyValue('--edge-c')).toBe('#abcdef');
  });

  it('clearing overrides returns everything to the palette', () => {
    state = makeScene(nestedRaw());
    setColors(state, new Map([['z', '#123456']]));
    setColors(state, undefined);
    expect(zoneEl('z').style.getPropertyValue('--group-c')).toBe(GROUP_PALETTE[0]);
    expect(state.els.cards.get('loose')!.style.getPropertyValue('--entity-c')).toBe(GROUP_PALETTE[0]);
  });
});
