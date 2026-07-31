import { describe, expect, it } from 'vitest';
import {
  LOOP_MIN_OPACITY,
  TRANSITION_FADE_PERCENT,
  TRANSITION_MOVE_UNITS,
  TRANSITION_SPIN_DEGREES,
} from './constants';
import { emptyDocument, newObject } from './defaults';
import { bounds } from './geometry';
import { ease, paceHint, phaseOf, poseAll, poseAtState, runningOrder } from './pose';
import type { IconDoc, IconObject, Role, Sustain } from './types';

/** The 512-square board most of these fixtures assume. */
const BOARD = { width: 512, height: 512 };

function docWith(objects: IconObject[], states = ['idle', 'loading', 'done']): IconDoc {
  return {
    ...emptyDocument('test'),
    objects,
    states: states.map((name, i) => ({ id: `s${i}`, name, sustain: null })),
    timing: { speed: 1, ramp: 'linear', rest: 0 },
  };
}

function objectWith(role: Role, over: Partial<IconObject> = {}): IconObject {
  const base = newObject('rect', 1, BOARD);
  return { ...base, ...over, motion: { takesPart: true, role, pace: 1, ...over.motion } };
}

const settled = (doc: IconDoc, stateId: string) => ({
  from: stateId,
  to: stateId,
  t: 1,
  loop: null,
});

describe('phaseOf', () => {
  it('divides the states evenly, first at 0 and last at 1', () => {
    const states = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(phaseOf(states, 'a')).toBe(0);
    expect(phaseOf(states, 'b')).toBe(0.5);
    expect(phaseOf(states, 'c')).toBe(1);
  });

  it('a lone state is phase 0, which is what makes a static icon legal', () => {
    expect(phaseOf([{ id: 'only' }], 'only')).toBe(0);
  });

  it('an unknown state is phase 0 rather than NaN', () => {
    expect(phaseOf([{ id: 'a' }, { id: 'b' }], 'gone')).toBe(0);
  });
});

describe('ease', () => {
  it('pins both ends for every ramp', () => {
    for (const ramp of ['linear', 'soft', 'sharp'] as const) {
      expect(ease(ramp, 0)).toBe(0);
      expect(ease(ramp, 1)).toBe(1);
    }
  });
  it('linear is the identity', () => {
    expect(ease('linear', 0.37)).toBe(0.37);
  });
  it('soft and sharp both pass through the midpoint', () => {
    expect(ease('soft', 0.5)).toBeCloseTo(0.5);
    expect(ease('sharp', 0.5)).toBeCloseTo(0.5);
  });
  it('sharp starts slower than soft, which starts slower than linear', () => {
    expect(ease('sharp', 0.2)).toBeLessThan(ease('soft', 0.2));
    expect(ease('soft', 0.2)).toBeLessThan(ease('linear', 0.2));
  });
  it('clamps rather than extrapolating past the ends', () => {
    expect(ease('soft', 2)).toBe(1);
    expect(ease('soft', -1)).toBe(0);
  });
});

describe('each role in isolation', () => {
  it('spins turns by the fixed sweep across a full transition', () => {
    const doc = docWith([objectWith('spins')]);
    expect(poseAtState(doc, 's0')[0]?.rotation).toBe(0);
    expect(poseAtState(doc, 's2')[0]?.rotation).toBe(TRANSITION_SPIN_DEGREES % 360);
    expect(poseAtState(doc, 's1')[0]?.rotation).toBe(Math.round(TRANSITION_SPIN_DEGREES / 2));
  });

  it('moves travels down by the fixed distance', () => {
    const doc = docWith([objectWith('moves')]);
    const start = bounds(poseAtState(doc, 's0')[0]!);
    const end = bounds(poseAtState(doc, 's2')[0]!);
    expect(end.y - start.y).toBe(TRANSITION_MOVE_UNITS);
  });

  it('fades drops opacity by the fixed amount', () => {
    const doc = docWith([objectWith('fades')]);
    expect(poseAtState(doc, 's0')[0]?.opacity).toBe(100);
    expect(poseAtState(doc, 's2')[0]?.opacity).toBe(100 - TRANSITION_FADE_PERCENT);
  });

  it('a role changes only its own property', () => {
    const doc = docWith([objectWith('spins')]);
    const posed = poseAtState(doc, 's2')[0]!;
    expect(posed.opacity).toBe(100);
    expect(bounds(posed)).toEqual(bounds(doc.objects[0]!));
  });
});

describe('pace', () => {
  it('scales rotation, so a 2× object turns twice as far', () => {
    const doc = docWith([
      objectWith('spins', { id: 'fast', motion: { takesPart: true, role: 'spins', pace: 2 } }),
      objectWith('spins', { id: 'slow', motion: { takesPart: true, role: 'spins', pace: 1 } }),
    ]);
    const [fast, slow] = poseAtState(doc, 's2');
    expect(fast?.rotation).toBe((TRANSITION_SPIN_DEGREES * 2) % 360);
    expect(slow?.rotation).toBe(TRANSITION_SPIN_DEGREES % 360);
  });

  it('does not scale travel or fade — the transition distance is fixed', () => {
    const doc = docWith([
      objectWith('moves', { motion: { takesPart: true, role: 'moves', pace: 3 } }),
    ]);
    const start = bounds(poseAtState(doc, 's0')[0]!);
    const end = bounds(poseAtState(doc, 's2')[0]!);
    expect(end.y - start.y).toBe(TRANSITION_MOVE_UNITS);
  });
});

describe('taking part', () => {
  it('an object that takes no part is returned untouched at every state', () => {
    const still = objectWith('spins', {
      rotation: 17,
      motion: { takesPart: false, role: 'spins', pace: 1 },
    });
    const doc = docWith([still]);
    expect(poseAtState(doc, 's0')[0]).toBe(still);
    expect(poseAtState(doc, 's2')[0]).toBe(still);
  });
});

describe('artboard size', () => {
  const travelOn = (width: number, height: number) => {
    const doc: IconDoc = { ...docWith([objectWith('moves')]), artboard: { width, height } };
    return bounds(poseAtState(doc, 's2')[0]!).y - bounds(poseAtState(doc, 's0')[0]!).y;
  };

  it('scales travel with the board, so the motion has the same shape at any size', () => {
    expect(travelOn(512, 512)).toBe(TRANSITION_MOVE_UNITS);
    expect(travelOn(1024, 1024)).toBe(TRANSITION_MOVE_UNITS * 2);
    expect(travelOn(256, 256)).toBe(TRANSITION_MOVE_UNITS / 2);
  });

  it('takes its scale from the shorter edge, so a wide board does not overshoot', () => {
    // Travel is vertical; a 2048 × 256 board must not move things eight times
    // as far as a square 256 one does, just because it is wide.
    expect(travelOn(2048, 256)).toBe(travelOn(256, 256));
  });
});

describe('sustained loops', () => {
  const sustainedDoc = (sustain: Sustain, role: Role): IconDoc => {
    const doc = docWith([objectWith(role)]);
    return {
      ...doc,
      states: doc.states.map((state, i) => (i === 2 ? { ...state, sustain } : state)),
    };
  };

  it('is periodic — the pose at loop 0 and loop 1 agree', () => {
    const doc = sustainedDoc('pulsing', 'fades');
    const start = poseAll(doc, { from: 's2', to: 's2', t: 1, loop: 0 })[0];
    const end = poseAll(doc, { from: 's2', to: 's2', t: 1, loop: 1 })[0];
    expect(end?.opacity).toBe(start?.opacity);
  });

  it('does not run until the transition into the state has finished', () => {
    const doc = sustainedDoc('turning', 'spins');
    const midTransition = poseAll(doc, { from: 's0', to: 's2', t: 0.5, loop: 0.5 })[0];
    const noLoop = poseAll(doc, { from: 's0', to: 's2', t: 0.5, loop: null })[0];
    expect(midTransition?.rotation).toBe(noLoop?.rotation);
  });

  it('turning drives spin at full amplitude and only nudges the others', () => {
    const quarterTurn = (role: Role) => {
      const doc = sustainedDoc('turning', role);
      const at = (loop: number) => poseAll(doc, { from: 's2', to: 's2', t: 1, loop })[0]!;
      return { held: at(0), quarter: at(0.25) };
    };
    const spins = quarterTurn('spins');
    expect(spins.quarter.rotation - spins.held.rotation).toBe(90);
    const fades = quarterTurn('fades');
    expect(fades.quarter.opacity).toBeLessThan(fades.held.opacity);
  });

  it('never fades an object entirely away', () => {
    const doc = sustainedDoc('pulsing', 'fades');
    for (let loop = 0; loop <= 1; loop += 0.05) {
      const posed = poseAll(doc, { from: 's2', to: 's2', t: 1, loop })[0]!;
      expect(posed.opacity).toBeGreaterThanOrEqual(LOOP_MIN_OPACITY);
      expect(posed.opacity).toBeLessThanOrEqual(100);
    }
  });

  it('rest spread offsets each object further round the cycle than the last', () => {
    const base = docWith([
      objectWith('moves', { id: 'a' }),
      objectWith('moves', { id: 'b' }),
    ]);
    const doc: IconDoc = {
      ...base,
      states: base.states.map((s, i) => (i === 2 ? { ...s, sustain: 'travelling' as const } : s)),
      timing: { speed: 1, ramp: 'linear', rest: 0.18 },
    };
    const [a, b] = poseAll(doc, { from: 's2', to: 's2', t: 1, loop: 0.25 });
    expect(bounds(a!).y).not.toBe(bounds(b!).y);
  });

  it('with no rest spread the objects move together', () => {
    const base = docWith([objectWith('moves', { id: 'a' }), objectWith('moves', { id: 'b' })]);
    const doc: IconDoc = {
      ...base,
      states: base.states.map((s, i) => (i === 2 ? { ...s, sustain: 'travelling' as const } : s)),
      timing: { speed: 1, ramp: 'linear', rest: 0 },
    };
    const [a, b] = poseAll(doc, { from: 's2', to: 's2', t: 1, loop: 0.25 });
    expect(bounds(a!).y).toBe(bounds(b!).y);
  });
});

describe('poseAtState', () => {
  it('a sustained state settles on the pose it enters the loop at, never a mid-loop frame', () => {
    const base = docWith([objectWith('spins')]);
    const doc: IconDoc = {
      ...base,
      states: base.states.map((s, i) => (i === 2 ? { ...s, sustain: 'turning' as const } : s)),
    };
    expect(poseAtState(doc, 's2')[0]?.rotation).toBe(
      poseAll(doc, { from: 's2', to: 's2', t: 1, loop: 0 })[0]?.rotation,
    );
  });
});

describe('running order', () => {
  const doc = docWith([
    objectWith('spins', { id: 'seal', name: 'mark', motion: { takesPart: true, role: 'spins', pace: 2 } }),
    objectWith('moves', { id: 'stripe', name: 'stripe', motion: { takesPart: true, role: 'moves', pace: 1 } }),
    objectWith('fades', { id: 'plate', name: 'plate', motion: { takesPart: true, role: 'fades', pace: 0.5 } }),
    objectWith('moves', { id: 'backdrop', name: 'backdrop', motion: { takesPart: false, role: 'moves', pace: 1 } }),
  ]);

  it('is by pace, fastest first, and excludes objects that take no part', () => {
    expect(runningOrder(doc).map((o) => o.id)).toEqual(['seal', 'stripe', 'plate']);
  });

  it('names who leads and who follows', () => {
    expect(paceHint(doc, 'seal')).toBe('leads — stripe, plate follow');
    expect(paceHint(doc, 'stripe')).toBe('follows mark');
    expect(paceHint(doc, 'plate')).toBe('resolves last, after stripe');
  });

  it('says so when an object is alone in the animation', () => {
    const solo = docWith([objectWith('spins', { id: 'only' })]);
    expect(paceHint(solo, 'only')).toBe('the only object in the animation');
  });

  it('has nothing to say about an object that takes no part', () => {
    expect(paceHint(doc, 'backdrop')).toBeNull();
  });
});
