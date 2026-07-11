import { afterEach, describe, expect, it } from 'vitest';

import { cleanupScene, makeScene } from '../../test/scene';
import { relayout } from './relayout';
import type { EngineState } from '../types';

let state: EngineState;
afterEach(() => cleanupScene(state));

const zoneEl = (id: string) =>
  [...state.els.groupLayer.children].find((c) => (c as HTMLElement).dataset.group === id) as HTMLElement;

describe('relayout', () => {
  it('resyncs zone box position, card transform, and svg size from the model', () => {
    state = makeScene();
    state.model.entityById.get('users')!.x = 999;
    state.model.entityById.get('users')!.y = 777;
    const b = state.model._groupBounds.find((g) => g.id === 'z1')!;
    b.x = 123;
    b.y = 45;
    state.model._content.w = 2000;
    state.model._content.h = 1500;
    relayout(state);
    expect(zoneEl('z1').style.left).toBe('123px');
    expect(zoneEl('z1').style.top).toBe('45px');
    expect(state.els.cards.get('users')!.style.transform).toBe('translate(999px, 777px)');
    expect(state.els.svg.style.width).toBe('2000px');
    expect(state.els.svg.style.height).toBe('1500px');
  });

  it('re-applies the measured card width so ports stay aligned', () => {
    state = makeScene();
    state.model.entityById.get('orders')!._w = 321;
    relayout(state);
    expect(state.els.cards.get('orders')!.style.width).toBe('321px');
  });

  it('redraws edges from the moved coordinates', () => {
    state = makeScene();
    const before = state.els.edgeEls.get('u-o')!.path.getAttribute('d');
    const users = state.model.entityById.get('users')!;
    users.x += 500;
    users.y += 300;
    relayout(state);
    const after = state.els.edgeEls.get('u-o')!.path.getAttribute('d');
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });
});
