import { describe, expect, test } from 'vitest';
import { DEFAULT_CONFIG, type MarkConfig, type RestPose } from './config';
import {
  ASTERISK_GAP,
  coastDegrees,
  cycleLength,
  cyclePhaseAt,
  cyclePose,
  IDLE_HOLD,
  poseAt,
  rampSpread,
  ramps,
  restAngles,
  RUNNING_HOLD,
  runningHoldSeconds,
  runningPose,
  separations,
  smootherstep,
  specStagger,
  spinDownPose,
  spinUpPose,
  sweptDegrees,
  transitionSeconds,
} from './motion';

function withMotion(patch: Partial<MarkConfig['motion']>): MarkConfig {
  return { ...DEFAULT_CONFIG, motion: { ...DEFAULT_CONFIG.motion, ...patch } };
}

/**
 * A stick is 180°-symmetric, so a gap of 0 and a gap of 180 are the same gap.
 * Comparing raw numbers would call a gap that lands a hair below zero — and so
 * wraps to 179.999 — a 180° error, which is a wrap artefact rather than drift.
 */
function gapDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}

// The matrix the mark spec says it verified the loader against.
const SPEEDS = [40, 120, 260];
const SPREADS = [0, 8, 24];
const POSES: RestPose[] = ['logo', 'fan'];

describe('the easing', () => {
  test('is pinned at both ends', () => {
    expect(smootherstep(0)).toBe(0);
    expect(smootherstep(1)).toBe(1);
    expect(smootherstep(0.5)).toBeCloseTo(0.5, 10);
  });

  test('leaves and arrives with zero velocity and zero acceleration', () => {
    // The property that distinguishes smootherstep from smoothstep, and the
    // reason a stick neither jerks off the mark nor lands with a visible stop.
    const h = 1e-4;
    const d1 = (u: number) => (smootherstep(u + h) - smootherstep(u - h)) / (2 * h);
    const d2 = (u: number) =>
      (smootherstep(u + h) - 2 * smootherstep(u) + smootherstep(u - h)) / (h * h);

    for (const end of [0, 1]) {
      const at = end === 0 ? h * 2 : 1 - h * 2;
      expect(Math.abs(d1(at))).toBeLessThan(0.01);
      expect(Math.abs(d2(at))).toBeLessThan(0.1);
    }
    // Fastest in the middle, so the ramp actually goes somewhere.
    expect(d1(0.5)).toBeGreaterThan(1.5);
  });
});

describe('the ramp integral', () => {
  test('is continuous where the ramp ends', () => {
    const ramp = 0.9;
    const speed = 120;
    const step = 1e-6;
    const before = sweptDegrees(speed, ramp, ramp - step);
    const at = sweptDegrees(speed, ramp, ramp);
    // A stick never exceeds `speed`, so across `step` seconds the swept angle
    // cannot move further than `speed * step`. Asserting a tighter bound than
    // that would be asserting the sampling error, not continuity.
    expect(Math.abs(at - before)).toBeLessThanOrEqual(speed * step * 1.001);
  });

  test('gives up exactly half a ramp of distance to accelerating', () => {
    // The constant that makes a staggered start produce a fixed separation.
    const speed = 120;
    const ramp = 0.9;
    for (const elapsed of [0.9, 1.5, 4]) {
      expect(sweptDegrees(speed, ramp, elapsed)).toBeCloseTo(speed * (elapsed - ramp / 2), 8);
    }
  });

  test('never moves a stick backwards', () => {
    let previous = -1;
    for (let e = 0; e < 2; e += 0.01) {
      const swept = sweptDegrees(120, 0.9, e);
      expect(swept).toBeGreaterThanOrEqual(previous);
      previous = swept;
    }
  });

  test('accelerating and decelerating over one ramp cover the same ground', () => {
    // Symmetry of the easing: what spin-up loses to its ramp, spin-down loses too.
    expect(coastDegrees(120, 0.9, 0.9)).toBeCloseTo(sweptDegrees(120, 0.9, 0.9), 8);
  });
});

describe('the ramps', () => {
  test('all three sticks are already moving the instant the transition starts', () => {
    // The defining property: simultaneous starts. Under a staggered-start model
    // the mid and low sticks sit still until their delay elapses, so this is
    // what separates the two designs.
    for (const restPose of POSES) {
      const config = withMotion({ restPose });
      const rest = restAngles(config);
      const moved = spinUpPose(config, 0.05);

      for (let i = 0; i < 3; i++) {
        expect(Math.abs((moved[i] ?? 0) - (rest[i] ?? 0))).toBeGreaterThan(0);
      }
    }
  });

  test('gives the leading stick the configured ramp and the trailing ones longer', () => {
    for (const speed of SPEEDS) {
      for (const restSpread of SPREADS) {
        const config = withMotion({ speed, restSpread, restPose: 'fan' });
        const [top, mid, low] = ramps(config);
        const spread = rampSpread(config.motion);

        expect(top).toBeCloseTo(config.motion.ramp, 10);
        expect(mid).toBeCloseTo(config.motion.ramp + spread, 10);
        expect(low).toBeCloseTo(config.motion.ramp + 2 * spread, 10);
      }
    }
  });

  test("each ramp difference is twice the spec's derived stagger", () => {
    // The spec expressed the offset as a start delay Δd; with simultaneous
    // starts the same separation comes from a ramp that is 2Δd longer, because
    // a ramp costs a stick half its length in distance.
    for (const speed of SPEEDS) {
      for (const restSpread of SPREADS) {
        const motion = { ...DEFAULT_CONFIG.motion, speed, restSpread };
        expect(rampSpread(motion)).toBeCloseTo(2 * specStagger(motion), 10);
      }
    }
  });

  test('runs a transition until the slowest stick finishes accelerating', () => {
    for (const speed of SPEEDS) {
      for (const restSpread of SPREADS) {
        const config = withMotion({ speed, restSpread, restPose: 'fan' });
        expect(transitionSeconds(config)).toBeCloseTo(
          config.motion.ramp + 2 * rampSpread(config.motion),
          10,
        );
      }
    }
  });

  test('accelerates the top stick hardest, and never asks for a negative ramp', () => {
    for (const restPose of POSES) {
      const perStick = ramps(withMotion({ restPose }));
      expect(Math.min(...perStick)).toBeGreaterThanOrEqual(0);
      expect(perStick[0]).toBeLessThanOrEqual(perStick[1]);
      expect(perStick[1]).toBeLessThanOrEqual(perStick[2]);
    }
  });

  test('keeps every ramp real even for a pose that runs the other way', () => {
    // Angles ordered so the top stick trails rather than leads — the case that
    // would otherwise want a ramp shorter than zero.
    const reversed: MarkConfig = { ...withMotion({ restPose: 'logo' }), angles: [10, 80, 150] };
    expect(Math.min(...ramps(reversed))).toBeGreaterThanOrEqual(0);
  });
});

describe('the rest pose', () => {
  test('logo rests on the mark\'s own angles, so an idle loader is the favicon', () => {
    const config = withMotion({ restPose: 'logo' });
    expect(restAngles(config)).toEqual(config.angles);
  });

  test('fan rests restSpread apart, reading as one stroke', () => {
    const config = withMotion({ restPose: 'fan', restSpread: 8 });
    expect(separations(restAngles(config))).toEqual([8, 8]);
  });
});

describe('spin-up', () => {
  test('lands the asterisk exactly, from either pose, across the whole matrix', () => {
    for (const restPose of POSES) {
      for (const speed of SPEEDS) {
        for (const restSpread of SPREADS) {
          const config = withMotion({ speed, restSpread, restPose });
          const settled = spinUpPose(config, transitionSeconds(config));
          const [first, second] = separations(settled);

          expect(first).toBeCloseTo(ASTERISK_GAP, 6);
          expect(second).toBeCloseTo(ASTERISK_GAP, 6);
        }
      }
    }
  });

  test('starts on the rest pose', () => {
    for (const restPose of POSES) {
      const config = withMotion({ restPose });
      expect(spinUpPose(config, 0)).toEqual(restAngles(config));
    }
  });

  test('holds the asterisk once settled rather than drifting past it', () => {
    const config = withMotion({});
    for (const extra of [0, 0.5, 3, 10]) {
      const [first, second] = separations(runningPose(config, extra));
      expect(first).toBeCloseTo(ASTERISK_GAP, 6);
      expect(second).toBeCloseTo(ASTERISK_GAP, 6);
    }
  });
});

describe('spin-down', () => {
  test('folds back onto the rest pose exactly, across the whole matrix', () => {
    for (const restPose of POSES) {
      for (const speed of SPEEDS) {
        for (const restSpread of SPREADS) {
          const config = withMotion({ speed, restSpread, restPose });
          const folded = spinDownPose(config, transitionSeconds(config));
          const [wantFirst, wantSecond] = separations(restAngles(config));
          const [gotFirst, gotSecond] = separations(folded);

          expect(gapDiff(gotFirst, wantFirst)).toBeLessThan(1e-6);
          expect(gapDiff(gotSecond, wantSecond)).toBeLessThan(1e-6);
        }
      }
    }
  });

  test('starts from where running left the mark', () => {
    const config = withMotion({});
    expect(spinDownPose(config, 0)).toEqual(runningPose(config, 0));
  });

  test('stops the top stick first, and the others close on it after it has parked', () => {
    const config = withMotion({ restPose: 'fan' });
    const [topRamp, midRamp] = ramps(config);
    // Between the two ramps: the top stick has finished, the mid stick has not.
    const between = ((topRamp ?? 0) + (midRamp ?? 0)) / 2;

    const top = (t: number) => spinDownPose(config, t)[0];
    expect(top(between)).toBeCloseTo(top(between + 0.05), 6);

    // And while the mid stick is still moving, its gap to the parked top stick
    // is closing.
    const early = separations(spinDownPose(config, between))[0];
    const later = separations(spinDownPose(config, between + 0.05))[0];
    expect(later).toBeLessThan(early);
  });
});

describe('the self-cycling preview', () => {
  test('runs idle → spin-up → running → spin-down and loops', () => {
    const config = withMotion({});
    const transition = transitionSeconds(config);
    const running = runningHoldSeconds(config);

    expect(cyclePhaseAt(config, 0).phase).toBe('idle');
    expect(cyclePhaseAt(config, IDLE_HOLD + 0.01).phase).toBe('spin-up');
    expect(cyclePhaseAt(config, IDLE_HOLD + transition + 0.01).phase).toBe('running');
    expect(cyclePhaseAt(config, IDLE_HOLD + transition + running + 0.01).phase).toBe('spin-down');
    // One full loop on, back to the start.
    expect(cyclePhaseAt(config, cycleLength(config) + 0.01).phase).toBe('idle');
  });

  test('turns the mark a whole number of half-turns per cycle, so the logo lands upright', () => {
    // Without this the mark folds shut at an arbitrary orientation and the loop
    // visibly jumps — caught by the handover test below before it shipped.
    for (const restPose of POSES) {
      for (const speed of SPEEDS) {
        const config = withMotion({ speed, restPose });
        const hold = runningHoldSeconds(config);
        const turned = speed * (transitionSeconds(config) + hold);

        expect(turned % 180).toBeCloseTo(0, 6);
        // Running is what absorbs the correction, but it stays watchable.
        expect(hold).toBeGreaterThanOrEqual(RUNNING_HOLD);
      }
    }
  });

  test('never jumps the mark at a phase handover', () => {
    // A stick is 180°-symmetric, so equality mod 180 is what the eye sees.
    const config = withMotion({});
    const modulo = (a: number) => ((a % 180) + 180) % 180;
    const step = 1e-4;

    for (const boundary of [
      IDLE_HOLD,
      IDLE_HOLD + transitionSeconds(config),
      IDLE_HOLD + transitionSeconds(config) + runningHoldSeconds(config),
      cycleLength(config),
    ]) {
      const before = cyclePose(config, boundary - step);
      const after = cyclePose(config, boundary + step);
      for (let i = 0; i < 3; i++) {
        const drift = Math.abs(modulo(before[i] ?? 0) - modulo(after[i] ?? 0));
        expect(Math.min(drift, 180 - drift)).toBeLessThan(0.5);
      }
    }
  });
});

describe('poseAt', () => {
  test('holds each named phase at its end, so a paused control still shows it', () => {
    const config = withMotion({});
    const transition = transitionSeconds(config);
    expect(poseAt(config, 'spin-up', transition * 3)).toEqual(poseAt(config, 'spin-up', transition));
    expect(poseAt(config, 'spin-down', transition * 3)).toEqual(
      poseAt(config, 'spin-down', transition),
    );
  });

  test('idle is static', () => {
    const config = withMotion({});
    expect(poseAt(config, 'idle', 0)).toEqual(poseAt(config, 'idle', 99));
  });
});
