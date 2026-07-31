import { describe, expect, it } from 'vitest';
import { CYCLE_MS, TRANSITION_MS } from '../doc/constants';
import { emptyDocument } from '../doc/defaults';
import type { IconDoc, Sustain } from '../doc/types';
import { initialView, type ViewState } from '../view';
import { cycleSeconds, isLooping, readout, tick, transitionSeconds, wholeCycleSeconds } from './clock';

function docWith(sustains: Sustain[] = [null, null, null]): IconDoc {
  return {
    ...emptyDocument('test'),
    states: sustains.map((sustain, i) => ({ id: `s${i}`, name: `state ${i}`, sustain })),
  };
}

const viewOf = (doc: IconDoc, over: Partial<ViewState> = {}): ViewState => ({
  ...initialView(doc),
  from: 's0',
  to: 's0',
  ...over,
});

describe('durations', () => {
  it('scale with the document speed', () => {
    const doc = docWith();
    expect(transitionSeconds(doc)).toBe(TRANSITION_MS / 1000);
    expect(transitionSeconds({ ...doc, timing: { ...doc.timing, speed: 2 } })).toBe(
      TRANSITION_MS / 2000,
    );
    expect(cycleSeconds({ ...doc, timing: { ...doc.timing, speed: 0.5 } })).toBe(
      (CYCLE_MS * 2) / 1000,
    );
  });

  it('a whole cycle is every transition plus every sustained turn', () => {
    const none = docWith([null, null, null]);
    expect(wholeCycleSeconds(none)).toBeCloseTo(3 * transitionSeconds(none));
    const one = docWith([null, 'turning', null]);
    expect(wholeCycleSeconds(one)).toBeCloseTo(3 * transitionSeconds(one) + cycleSeconds(one));
  });
});

describe('isLooping', () => {
  const doc = docWith([null, 'turning', null]);

  it('is true only once the transition into a sustained state has finished', () => {
    expect(isLooping(doc, viewOf(doc, { to: 's1', t: 0.5 }))).toBe(false);
    expect(isLooping(doc, viewOf(doc, { to: 's1', t: 1 }))).toBe(true);
  });

  it('is false in a settled state, however long you sit in it', () => {
    expect(isLooping(doc, viewOf(doc, { to: 's0', t: 1 }))).toBe(false);
  });

  it('is false with motion off — there is no loop to be in', () => {
    expect(isLooping(doc, viewOf(doc, { to: 's1', t: 1, reducedMotion: true }))).toBe(false);
  });
});

describe('readout', () => {
  it('counts toward a total during a transition, because it has two ends', () => {
    const doc = docWith();
    expect(readout(doc, viewOf(doc, { t: 0.6 }))).toEqual({ top: '0.24s', bottom: 'of 0.40s' });
  });

  it('names a cycle in a sustained state, because it has none', () => {
    const doc = docWith([null, 'turning', null]);
    expect(readout(doc, viewOf(doc, { to: 's1', t: 1, loop: 0.62, playing: true }))).toEqual({
      top: '0.62 cycle',
      bottom: '0.90s loop ↻',
    });
  });

  it('says a loop is held when it is not running', () => {
    const doc = docWith([null, 'turning', null]);
    expect(readout(doc, viewOf(doc, { to: 's1', t: 1, loop: 0.62, playing: false })).top).toBe(
      'held 0.62',
    );
  });

  it('counts states rather than seconds while cycling through all of them', () => {
    const doc = docWith();
    expect(readout(doc, viewOf(doc, { to: 's1', cycling: true }))).toEqual({
      top: 'state 1 2/3',
      bottom: 'all states · 1.2s',
    });
  });

  it('states plainly that motion is off', () => {
    const doc = docWith();
    expect(readout(doc, viewOf(doc, { reducedMotion: true }))).toEqual({
      top: 'motion off',
      bottom: 'pose held',
    });
  });
});

describe('tick', () => {
  const doc = docWith();

  it('advances the transition in proportion to real elapsed time, not frames', () => {
    const half = tick(doc, viewOf(doc, { t: 0 }), TRANSITION_MS / 2);
    expect(half.t).toBeCloseTo(0.5);
    // The same wall-clock elapsed in one long frame lands in the same place.
    const whole = tick(doc, viewOf(doc, { t: 0 }), TRANSITION_MS);
    expect(whole.t).toBe(1);
  });

  it('scales with the document speed', () => {
    const fast: IconDoc = { ...doc, timing: { ...doc.timing, speed: 2 } };
    expect(tick(fast, viewOf(fast, { t: 0 }), TRANSITION_MS / 2).t).toBe(1);
  });

  it('stops at the end of a transition into a settled state', () => {
    const done = tick(doc, viewOf(doc, { from: 's0', to: 's1', t: 0.9 }), TRANSITION_MS);
    expect(done).toMatchObject({ t: 1, playing: false, to: 's1' });
  });

  it('starts looping at the end of a transition into a sustained state', () => {
    const sustained = docWith([null, 'turning', null]);
    const done = tick(
      sustained,
      viewOf(sustained, { from: 's0', to: 's1', t: 0.9 }),
      TRANSITION_MS,
    );
    expect(done).toMatchObject({ t: 1, loop: 0, playing: true });
  });

  it('wraps the loop rather than running past 1', () => {
    const sustained = docWith([null, 'turning', null]);
    const wrapped = tick(
      sustained,
      viewOf(sustained, { to: 's1', t: 1, loop: 0.9 }),
      CYCLE_MS / 2,
    );
    expect(wrapped.loop).toBeCloseTo(0.4);
    expect(wrapped.playing).toBe(true);
  });

  it('cycling walks to the next state and wraps at the end', () => {
    const first = tick(doc, viewOf(doc, { from: 's0', to: 's0', t: 1, cycling: true }), 0);
    expect(first).toMatchObject({ from: 's0', to: 's1', t: 0 });
    const last = tick(doc, viewOf(doc, { from: 's1', to: 's2', t: 1, cycling: true }), 0);
    expect(last).toMatchObject({ from: 's2', to: 's0', t: 0 });
  });

  it('cycling leaves a sustained state after one turn rather than looping forever', () => {
    const sustained = docWith([null, 'turning', null]);
    const moved = tick(
      sustained,
      viewOf(sustained, { from: 's0', to: 's1', t: 1, loop: 0.9, cycling: true }),
      CYCLE_MS / 2,
    );
    expect(moved).toMatchObject({ from: 's1', to: 's2', t: 0 });
  });

  it('a single-state document has nothing to traverse and simply stops', () => {
    const solo = docWith([null]);
    const view = viewOf(solo, { from: 's0', to: 's0', t: 1 });
    expect(tick(solo, view, 100).playing).toBe(false);
  });
});
