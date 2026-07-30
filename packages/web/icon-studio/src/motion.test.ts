import { describe, expect, test } from 'vitest';
import { DEFAULT_CONFIG, type MarkConfig, type RestPose } from './config';
import {
  ASTERISK_GAP,
  coastDegrees,
  isSpinning,
  lags,
  MARK_STATES,
  planMove,
  rampSpread,
  separations,
  smootherstep,
  specStagger,
  statePose,
  sweptDegrees,
  type Formation,
  type MarkState,
} from './motion';

function withMotion(patch: Partial<MarkConfig['motion']>): MarkConfig {
  return { ...DEFAULT_CONFIG, motion: { ...DEFAULT_CONFIG.motion, ...patch } };
}

/**
 * A stick is 180°-symmetric, so a gap of 0 and a gap of 180 are the same gap,
 * and 179.999 is a hair from 0 rather than 180 away. Comparing raw numbers would
 * report a wrap as a 180° error.
 */
function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}

function at(config: MarkConfig, from: Formation, to: MarkState) {
  const move = planMove(config, from, to);
  return { move, landed: move.pose(move.duration) };
}

function standing(config: MarkConfig, state: MarkState): Formation {
  return { pose: statePose(config, state), spinning: isSpinning(state) };
}

// The matrix the mark spec records the loader as verified against.
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
      const u = end === 0 ? h * 2 : 1 - h * 2;
      expect(Math.abs(d1(u))).toBeLessThan(0.01);
      expect(Math.abs(d2(u))).toBeLessThan(0.1);
    }
    expect(d1(0.5)).toBeGreaterThan(1.5);
  });
});

describe('the ramp integral', () => {
  test('is continuous where the ramp ends', () => {
    const speed = 120;
    const step = 1e-6;
    const before = sweptDegrees(speed, 0.9, 0.9 - step);
    const at909 = sweptDegrees(speed, 0.9, 0.9);
    // A stick never exceeds `speed`, so it cannot move further than
    // `speed × step` across that gap. A tighter bound would be asserting the
    // sampling error rather than continuity.
    expect(Math.abs(at909 - before)).toBeLessThanOrEqual(speed * step * 1.001);
  });

  test('gives up exactly half a ramp of distance to accelerating', () => {
    // The constant that turns a difference in ramps into a fixed separation.
    for (const elapsed of [0.9, 1.5, 4]) {
      expect(sweptDegrees(120, 0.9, elapsed)).toBeCloseTo(120 * (elapsed - 0.45), 8);
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
    expect(coastDegrees(120, 0.9, 0.9)).toBeCloseTo(sweptDegrees(120, 0.9, 0.9), 8);
  });
});

describe('the states', () => {
  test('running is the exact asterisk; the others are still', () => {
    const config = withMotion({});
    const [first, second] = separations(statePose(config, 'running'));
    expect(first).toBeCloseTo(ASTERISK_GAP, 10);
    expect(second).toBeCloseTo(ASTERISK_GAP, 10);

    expect(isSpinning('running')).toBe(true);
    expect(isSpinning('default')).toBe(false);
    expect(isSpinning('resting')).toBe(false);
  });

  test('default is the mark\'s own angles, so an idle loader is the favicon', () => {
    const config = withMotion({});
    expect(statePose(config, 'default')).toEqual(config.angles);
  });

  test('resting sits restSpread apart, reading as one stroke', () => {
    const config = withMotion({ restSpread: 8 });
    expect(separations(statePose(config, 'resting'))).toEqual([8, 8]);
  });
});

describe('every move', () => {
  test('starts exactly where the mark already is, so nothing jumps on click', () => {
    const config = withMotion({});
    for (const from of MARK_STATES) {
      for (const to of MARK_STATES) {
        const move = planMove(config, standing(config, from), to);
        expect(move.pose(0), `${from} → ${to}`).toEqual(statePose(config, from));
      }
    }
  });

  test('has a finite, non-negative duration across the whole matrix', () => {
    for (const restSpread of SPREADS) {
      for (const speed of SPEEDS) {
        const config = withMotion({ speed, restSpread });
        for (const from of MARK_STATES) {
          for (const to of MARK_STATES) {
            const { duration } = planMove(config, standing(config, from), to);
            expect(Number.isFinite(duration), `${from} → ${to}`).toBe(true);
            expect(duration).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  test('sets every stick that has somewhere to go moving from the first instant', () => {
    // Simultaneous starts: under a staggered-start model the trailing sticks
    // would sit still until their delay elapsed. Sticks already on their target
    // are excluded — `default` and `resting` share the same `top` anchor, so the
    // leading stick genuinely stays put between those two.
    const config = withMotion({});
    for (const from of MARK_STATES) {
      for (const to of MARK_STATES) {
        if (from === to) continue;
        const move = planMove(config, standing(config, from), to);
        const start = statePose(config, from);
        const landed = move.pose(move.duration);
        const early = move.pose(move.duration * 0.05);

        for (let i = 0; i < 3; i++) {
          const hasFurtherToGo = angleDiff(landed[i] ?? 0, start[i] ?? 0) > 1e-9;
          if (!hasFurtherToGo) continue;
          expect(
            Math.abs((early[i] ?? 0) - (start[i] ?? 0)),
            `${from} → ${to} stick ${i}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('moving into running', () => {
  test('lands the asterisk exactly, from either resting pose, across the matrix', () => {
    for (const restPose of POSES) {
      for (const speed of SPEEDS) {
        for (const restSpread of SPREADS) {
          const config = withMotion({ speed, restSpread, restPose });
          const from = standing(config, restPose === 'fan' ? 'resting' : 'default');
          const [first, second] = separations(at(config, from, 'running').landed);

          expect(first).toBeCloseTo(ASTERISK_GAP, 6);
          expect(second).toBeCloseTo(ASTERISK_GAP, 6);
        }
      }
    }
  });

  test('holds the asterisk once up to speed rather than drifting past it', () => {
    const config = withMotion({});
    const { move } = at(config, standing(config, 'default'), 'running');
    for (const extra of [0, 0.5, 3, 10]) {
      const [first, second] = separations(move.pose(move.duration + extra));
      expect(first).toBeCloseTo(ASTERISK_GAP, 6);
      expect(second).toBeCloseTo(ASTERISK_GAP, 6);
    }
  });

  test('gives the leading stick the configured ramp and the trailing ones longer', () => {
    for (const speed of SPEEDS) {
      for (const restSpread of SPREADS) {
        const config = withMotion({ speed, restSpread, restPose: 'fan' });
        const { move } = at(config, standing(config, 'resting'), 'running');
        // The slowest stick sets the duration: two ramp-steps past the leader's.
        expect(move.duration).toBeCloseTo(
          config.motion.ramp + 2 * rampSpread(config.motion),
          8,
        );
      }
    }
  });

  test("each ramp step is twice the spec's derived stagger", () => {
    for (const speed of SPEEDS) {
      for (const restSpread of SPREADS) {
        const motion = { ...DEFAULT_CONFIG.motion, speed, restSpread };
        expect(rampSpread(motion)).toBeCloseTo(2 * specStagger(motion), 10);
      }
    }
  });

  test('is a no-op when already running, and keeps turning', () => {
    const config = withMotion({});
    const move = planMove(config, standing(config, 'running'), 'running');
    expect(move.duration).toBe(0);
    expect(move.spinning).toBe(true);
    // Still turning at full speed after the (zero-length) move.
    const turned = move.pose(1);
    expect((turned[0] ?? 0) - (statePose(config, 'running')[0] ?? 0)).toBeCloseTo(
      config.motion.speed,
      6,
    );
  });
});

describe('moving out of running', () => {
  test('lands on the target pose exactly — orientation included — across the matrix', () => {
    // The coast exists for this: decelerating alone closes the formation but
    // parks it at whatever angle the spinning reached.
    for (const to of ['default', 'resting'] as const) {
      for (const speed of SPEEDS) {
        for (const restSpread of SPREADS) {
          const config = withMotion({ speed, restSpread });
          const { landed } = at(config, standing(config, 'running'), to);
          const target = statePose(config, to);

          for (let i = 0; i < 3; i++) {
            expect(angleDiff(landed[i] ?? 0, target[i] ?? 0), `${to} stick ${i}`)
              .toBeLessThan(1e-6);
          }
        }
      }
    }
  });

  test('stops turning', () => {
    const config = withMotion({});
    expect(planMove(config, standing(config, 'running'), 'default').spinning).toBe(false);
  });

  test('waits no more than a half-turn before slowing', () => {
    // The coast is the shortest wait that makes the landing exact, so it can
    // never add a visible stall.
    for (const speed of SPEEDS) {
      const config = withMotion({ speed });
      const { move } = at(config, standing(config, 'running'), 'default');
      const decelerating = config.motion.ramp + 2 * (180 / speed);
      expect(move.duration).toBeLessThanOrEqual(180 / speed + decelerating + 1e-9);
    }
  });

  test('parks the leading stick first, and the others close on it', () => {
    const config = withMotion({ restSpread: 8 });
    const { move } = at(config, standing(config, 'running'), 'resting');
    const top = (t: number) => move.pose(t)[0];

    // The leader is on the shortest ramp, so it is stationary before the move ends.
    expect(top(move.duration - 1e-3)).toBeCloseTo(top(move.duration), 6);

    // And while the others still run, the formation is closing — the gap is
    // approaching the resting spread, not lingering near the asterisk's 60°.
    const [targetGap] = separations(statePose(config, 'resting'));
    const early = separations(move.pose(move.duration * 0.6))[0];
    const later = separations(move.pose(move.duration * 0.85))[0];
    expect(angleDiff(later, targetGap)).toBeLessThan(angleDiff(early, targetGap));
  });
});

describe('moving between two still poses', () => {
  test('lands on the target pose exactly, both ways', () => {
    for (const restSpread of SPREADS) {
      const config = withMotion({ restSpread });
      for (const [from, to] of [
        ['default', 'resting'],
        ['resting', 'default'],
      ] as const) {
        const { landed } = at(config, standing(config, from), to);
        const target = statePose(config, to);
        for (let i = 0; i < 3; i++) {
          expect(angleDiff(landed[i] ?? 0, target[i] ?? 0), `${from} → ${to}`)
            .toBeLessThan(1e-9);
        }
      }
    }
  });

  test('turns each stick the short way round rather than the long way', () => {
    // The mid stick sits *ahead* of where resting wants it, so the short way is
    // backwards. With the locked angles every target happens to lie forwards,
    // which would let a forward-only implementation pass — so this case is
    // chosen to force the direction flip.
    const config: MarkConfig = {
      ...withMotion({ restSpread: 8 }),
      angles: [62, 70, 160],
    };
    const start = statePose(config, 'default');
    const { move } = at(config, standing(config, 'default'), 'resting');
    const landed = move.pose(move.duration);

    const turns = [0, 1, 2].map((i) => (landed[i] ?? 0) - (start[i] ?? 0));
    // Nothing takes the long way: a quarter turn is the most any stick needs.
    for (const turn of turns) expect(Math.abs(turn)).toBeLessThanOrEqual(90 + 1e-9);
    // And at least one stick really does turn backwards here.
    expect(Math.min(...turns)).toBeLessThan(0);
  });

  test('a round trip comes back to where it started', () => {
    const config = withMotion({});
    const out = at(config, standing(config, 'default'), 'resting');
    const back = at(config, { pose: out.landed, spinning: false }, 'default');
    const target = statePose(config, 'default');

    for (let i = 0; i < 3; i++) {
      expect(angleDiff(back.landed[i] ?? 0, target[i] ?? 0)).toBeLessThan(1e-9);
    }
  });
});

describe('interrupting a move', () => {
  test('re-planning from a half-finished pose still lands exactly', () => {
    // Clicking a second state mid-flight: the new move starts from wherever the
    // mark actually is, which must not degrade the landing.
    const config = withMotion({});
    const spinUp = planMove(config, standing(config, 'default'), 'running');
    const halfway = { pose: spinUp.pose(spinUp.duration / 2), spinning: false };

    const { landed } = at(config, halfway, 'resting');
    const target = statePose(config, 'resting');
    for (let i = 0; i < 3; i++) {
      expect(angleDiff(landed[i] ?? 0, target[i] ?? 0)).toBeLessThan(1e-9);
    }
  });
});
