import type { MarkConfig, MotionConfig } from './config';

/**
 * The loader as a state machine. The mark sits in one of a few named states and
 * *moves* between them; every move is planned up front as a closed-form
 * function of time, so nothing integrates frame by frame, nothing drifts, and
 * no move needs a snap at its end to straighten the formation.
 *
 * **Sticks always start moving together and accelerate differently.** Past its
 * ramp a stick has given up exactly half a ramp's worth of distance to
 * accelerating — `speed × ramp / 2`, whatever the easing's shape — so two
 * sticks sharing a top speed end up permanently `speed × (Rᵢ − R₀) / 2` apart.
 * A difference in ramps therefore buys an exact separation, with no staggered
 * starts anywhere in the model.
 */

/** Degrees between neighbouring sticks while running: a rigid three-armed asterisk. */
export const ASTERISK_GAP = 60;

/** The states the mark can rest in or run in. */
export const MARK_STATES = ['default', 'resting', 'running'] as const;
export type MarkState = (typeof MARK_STATES)[number];

type Triple = [number, number, number];

/** Where the mark is right now: three angles, and whether it is still turning. */
export interface Formation {
  pose: Triple;
  spinning: boolean;
}

/** A planned move. `pose(t)` is valid for `0 ≤ t ≤ duration`. */
export interface Move {
  to: MarkState;
  /** Seconds. Zero when the mark is already in the target state. */
  duration: number;
  /** Whether the mark is still turning when the move ends. */
  spinning: boolean;
  pose: (t: number) => Triple;
}

function triple(values: number[]): Triple {
  const [a, b, c] = values;
  return [a ?? 0, b ?? 0, c ?? 0];
}

/**
 * A stick is a full diameter, so it looks identical at θ and θ+180 — every
 * angular distance in here wraps at 180, not 360.
 */
function mod180(degrees: number): number {
  return ((degrees % 180) + 180) % 180;
}

/** How far `behind` sits behind `ahead`, in [0, 180). */
function leadingGap(ahead: number, behind: number): number {
  return mod180(ahead - behind);
}

/** The shortest way to turn a stick from `from` onto `to`, in (−90, 90]. */
function shortestTurn(from: number, to: number): number {
  const forward = mod180(to - from);
  return forward > 90 ? forward - 180 : forward;
}

/**
 * Smootherstep: zero velocity *and* zero acceleration at both ends, so a stick
 * neither jerks into motion nor lands with a visible stop.
 */
export function smootherstep(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return u * u * u * (u * (6 * u - 15) + 10);
}

/**
 * Degrees swept by a stick ramping 0 → `speed` over `ramp` seconds on
 * smootherstep. The exact integral of `speed × smootherstep(t / ramp)`: past the
 * ramp the stick runs at full speed, half a ramp's distance down.
 */
export function sweptDegrees(speed: number, ramp: number, elapsed: number): number {
  if (elapsed <= 0) return 0;
  if (ramp <= 0) return speed * elapsed;
  if (elapsed >= ramp) return speed * (elapsed - ramp / 2);
  const u = elapsed / ramp;
  // ∫₀ᵘ smootherstep = u⁶ − 3u⁵ + 2.5u⁴, scaled back into seconds by `ramp`.
  return speed * ramp * (u ** 6 - 3 * u ** 5 + 2.5 * u ** 4);
}

/** Degrees a decelerating stick still covers: full speed minus what it gives up. */
export function coastDegrees(speed: number, ramp: number, elapsed: number): number {
  if (elapsed <= 0) return 0;
  if (ramp <= 0) return 0;
  if (elapsed >= ramp) return (speed * ramp) / 2;
  return speed * elapsed - sweptDegrees(speed, ramp, elapsed);
}

/** The formation each state holds, in `top, mid, low` order. */
export function statePose(config: MarkConfig, state: MarkState): Triple {
  const [top, mid, low] = config.angles;
  switch (state) {
    case 'default':
      return [top, mid, low];
    case 'resting': {
      const { restSpread } = config.motion;
      return [top, top - restSpread, top - 2 * restSpread];
    }
    case 'running':
      return [top, top - ASTERISK_GAP, top - 2 * ASTERISK_GAP];
  }
}

export function isSpinning(state: MarkState): boolean {
  return state === 'running';
}

/** How far each stick trails the leader, in [0, 180). Always `0` for the leader. */
export function lags(pose: Triple): Triple {
  const [lead] = pose;
  return triple(pose.map((angle) => leadingGap(lead, angle)));
}

/**
 * Each stick's ramp, given how many degrees it must cover *relative to the
 * leader*. A ramp costs a stick half its length in distance, so `d` degrees of
 * relative travel takes `2d / speed` extra seconds of ramp. The leader keeps the
 * configured ramp and the others grow from it, which is what makes `motion.ramp`
 * a value you can feel: it is the leading stick's acceleration.
 */
function rampsFor(motion: MotionConfig, relative: Triple): Triple {
  const { speed, ramp } = motion;
  return triple(relative.map((degrees) => ramp + (2 * degrees) / speed));
}

/**
 * The relative travel each stick needs to get from the lags it has to the ones
 * it wants. Two things are going on here.
 *
 * **Direction.** It depends on which way the ramp cuts:
 *
 * - **Accelerating**, a longer ramp covers *less* ground, so a stick that needs
 *   to fall further behind wants `wanted − have`.
 * - **Decelerating**, a longer ramp covers *more* ground, so a stick that needs
 *   to close up wants `have − wanted`.
 *
 * Getting these the same way round lands the formation 50° out.
 *
 * **Order.** The sticks must come out fastest-to-slowest in painted order — top
 * (blue), then mid (green), then low (red) — whatever angles the mark is
 * configured with. Taking each lag difference at face value does not give that:
 * from angles `10/55/100` the raw travels are `0 / 105 / 30`, which makes green
 * the slowest and red the middle, the wrong way round.
 *
 * Adding a half-turn to a stick's travel lands the *same* formation, because a
 * stick is a full diameter and so identical every 180°. So each successive stick
 * is lifted by half-turns until it needs at least as much travel as the one
 * before it — which fixes the ordering while leaving every landing exact.
 */
function relativeTravel(have: Triple, wanted: Triple, mode: 'accelerating' | 'decelerating'): Triple {
  const out: number[] = [];
  let previous = 0;
  for (let i = 0; i < have.length; i++) {
    const lag = have[i] ?? 0;
    const want = wanted[i] ?? 0;
    let travel = mode === 'accelerating' ? mod180(want - lag) : mod180(lag - want);
    while (travel < previous) travel += 180;
    out.push(travel);
    previous = travel;
  }
  return triple(out);
}

/** Plan the move from where the mark is now onto `to`. */
export function planMove(config: MarkConfig, from: Formation, to: MarkState): Move {
  const { speed } = config.motion;
  const target = statePose(config, to);

  // Already turning and asked to keep turning: nothing to change.
  if (to === 'running' && from.spinning) {
    return {
      to,
      duration: 0,
      spinning: true,
      pose: (t) => triple(from.pose.map((angle) => angle + speed * t)),
    };
  }

  // Standing still, asked to run: accelerate, opening into the asterisk. Every
  // stick moves from the first instant; the trailing ones accelerate slower.
  if (to === 'running') {
    const perStick = rampsFor(
      config.motion,
      relativeTravel(
        lags(from.pose),
        triple([0, ASTERISK_GAP, 2 * ASTERISK_GAP]),
        'accelerating',
      ),
    );
    return {
      to,
      duration: Math.max(...perStick),
      spinning: true,
      pose: (t) => triple(from.pose.map((a, i) => a + sweptDegrees(speed, perStick[i] ?? 0, t))),
    };
  }

  // Turning, asked to stop on a pose. Decelerating closes the formation, but the
  // orientation it lands on is whatever the spinning reached — which would park
  // the logo at an arbitrary angle. So hold full speed for a coast first, chosen
  // as the shortest wait that makes the landing exact. At most a half-turn.
  if (from.spinning) {
    const perStick = rampsFor(
      config.motion,
      relativeTravel(lags(from.pose), lags(target), 'decelerating'),
    );
    const leadRamp = perStick[0] ?? 0;
    const overshoot = (from.pose[0] ?? 0) + (speed * leadRamp) / 2;
    const coast = mod180((target[0] ?? 0) - overshoot) / speed;
    return {
      to,
      duration: coast + Math.max(...perStick),
      spinning: false,
      pose: (t) =>
        triple(
          from.pose.map(
            (a, i) =>
              a + speed * Math.min(Math.max(t, 0), coast) +
              coastDegrees(speed, perStick[i] ?? 0, t - coast),
          ),
        ),
    };
  }

  // Both poses are still: turn each stick the short way onto its target over one
  // shared duration. Sticks with further to go move faster, so they still start
  // and stop together with different accelerations.
  const turns = triple(from.pose.map((a, i) => shortestTurn(a, target[i] ?? 0)));
  const furthest = Math.max(...turns.map(Math.abs));
  const duration = Math.max(config.motion.ramp, (2 * furthest) / speed);
  return {
    to,
    duration,
    spinning: false,
    pose: (t) =>
      triple(from.pose.map((a, i) => a + (turns[i] ?? 0) * smootherstep(t / duration))),
  };
}

/** Gaps between neighbouring sticks, wrapped at 180. Used by readouts and tests. */
export function separations(pose: Triple): [number, number] {
  const [top, mid, low] = pose;
  return [leadingGap(top, mid), leadingGap(mid, low)];
}

/**
 * How much longer each successive stick's ramp runs when opening from an evenly
 * spaced pose: twice the stagger `Δd = (60 − restSpread) / speed` that the mark
 * spec derived for its earlier staggered-start draft. Starts are simultaneous
 * now, so the same separation comes from a ramp difference of twice the size.
 */
export function rampSpread(motion: MotionConfig): number {
  return (2 * (ASTERISK_GAP - motion.restSpread)) / motion.speed;
}

/** The spec's derived stagger, kept as the readable half of `rampSpread`. */
export function specStagger(motion: MotionConfig): number {
  return (ASTERISK_GAP - motion.restSpread) / motion.speed;
}
