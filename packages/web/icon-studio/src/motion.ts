import type { Element, IconDoc, MotionConfig } from './doc';

/**
 * The loader as a state machine. The mark sits in one of a few named states and
 * *moves* between them; every move is planned up front as a closed-form
 * function of time, so nothing integrates frame by frame, nothing drifts, and
 * no move needs a snap at its end to straighten the formation.
 *
 * **Elements always start moving together and accelerate differently.** Past
 * its ramp an element has given up exactly half a ramp's worth of distance to
 * accelerating — `speed × ramp / 2`, whatever the easing's shape — so two
 * elements sharing a top speed end up permanently `speed × (Rᵢ − R₀) / 2`
 * apart. A difference in ramps therefore buys an exact separation, with no
 * staggered starts anywhere in the model.
 *
 * Only elements with `spin: true` take part in any of this. Everything else in
 * the document holds its pose through every move — it is drawn, but it never
 * turns.
 */

/** The states the mark can rest in or run in. */
export const MARK_STATES = ['default', 'resting', 'running'] as const;
export type MarkState = (typeof MARK_STATES)[number];

/** Where the mark is right now: one angle per element, and whether it is still turning. */
export interface Formation {
  pose: number[];
  spinning: boolean;
}

/** A planned move. `pose(t)` is valid for `0 ≤ t ≤ duration`. */
export interface Move {
  to: MarkState;
  /** Seconds. Zero when the mark is already in the target state. */
  duration: number;
  /** Whether the mark is still turning when the move ends. */
  spinning: boolean;
  pose: (t: number) => number[];
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

/**
 * Degrees between neighbouring sticks in the running formation. A stick is a
 * full diameter and so 180°-symmetric, which is why the circle to divide is 180
 * and not 360 — three sticks land 60° apart, the value the mark spec locks.
 */
export function formationGap(count: number): number {
  return count > 0 ? 180 / count : 0;
}

/** Indexes of the elements taking part in the formation, in painted order. */
export function spinningIndexes(doc: IconDoc): number[] {
  const out: number[] = [];
  doc.elements.forEach((element, i) => {
    if (element.spin) out.push(i);
  });
  return out;
}

/** A ring or dot has no angle of its own, so it contributes `0` — it never spins anyway. */
function angleOf(element: Element): number {
  return element.type === 'stick' ? element.angle : 0;
}

/**
 * The formation each state holds: one angle per element, in document order.
 * Non-spinning elements always sit at their own angle. Spinning elements are
 * fanned out from the first spinner (the leader) — by `restSpread` at rest, by
 * `formationGap(spinnerCount)` while running.
 */
export function statePose(doc: IconDoc, state: MarkState): number[] {
  const spinners = spinningIndexes(doc);
  const pose = doc.elements.map(angleOf);
  const leadIndex = spinners[0];
  // Nothing spins: every state is the same still drawing.
  if (leadIndex === undefined) return pose;
  const lead = pose[leadIndex] ?? 0;
  const gap = state === 'resting' ? doc.motion.restSpread : formationGap(spinners.length);

  if (state === 'default') return pose;
  spinners.forEach((index, order) => {
    pose[index] = lead - gap * order;
  });
  return pose;
}

export function isSpinning(state: MarkState): boolean {
  return state === 'running';
}

/**
 * How far each element in `pose` trails the leader (`pose[0]`), in [0, 180).
 * Always `0` for the leader itself. Callers pass in whatever subset of the
 * full pose they care about — `planMove` always calls this with the spinning
 * elements only, in their formation order, so `pose[0]` is the lead spinner.
 */
export function lags(pose: number[]): number[] {
  const lead = pose[0] ?? 0;
  return pose.map((angle) => leadingGap(lead, angle));
}

/**
 * Each spinning element's ramp, given how many degrees it must cover *relative
 * to the leader*. A ramp costs an element half its length in distance, so `d`
 * degrees of relative travel takes `2d / speed` extra seconds of ramp. The
 * leader keeps the configured ramp and the others grow from it, which is what
 * makes `motion.ramp` a value you can feel: it is the leading element's
 * acceleration.
 */
function rampsFor(motion: MotionConfig, relative: number[]): number[] {
  const { speed, ramp } = motion;
  return relative.map((degrees) => ramp + (2 * degrees) / speed);
}

/**
 * The relative travel each spinning element needs to get from the lags it has
 * to the ones it wants. Two things are going on here.
 *
 * **Direction.** It depends on which way the ramp cuts:
 *
 * - **Accelerating**, a longer ramp covers *less* ground, so an element that
 *   needs to fall further behind wants `wanted − have`.
 * - **Decelerating**, a longer ramp covers *more* ground, so an element that
 *   needs to close up wants `have − wanted`.
 *
 * Getting these the same way round lands the formation 50° out.
 *
 * **Order.** The elements must come out fastest-to-slowest in painted order —
 * `elements[0]` leads, then `elements[1]`, and so on — whatever angles the
 * document is configured with. Taking each lag difference at face value does
 * not give that: from angles `10/55/100` the raw travels are `0 / 105 / 30`,
 * which makes the second element the slowest and the third the middle, the
 * wrong way round.
 *
 * Adding a half-turn to an element's travel lands the *same* formation,
 * because a stick is a full diameter and so identical every 180°. So each
 * successive element is lifted by half-turns until it needs at least as much
 * travel as the one before it — which fixes the ordering while leaving every
 * landing exact.
 */
function relativeTravel(
  have: number[],
  wanted: number[],
  mode: 'accelerating' | 'decelerating',
): number[] {
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
  return out;
}

/** Plan the move from where the mark is now onto `to`. */
export function planMove(doc: IconDoc, from: Formation, to: MarkState): Move {
  const { speed } = doc.motion;
  const target = statePose(doc, to);
  const spinners = spinningIndexes(doc);

  // Nothing in the document spins: there is no formation to open, close or
  // reorder, so every move is a no-op that keeps whatever pose the document's
  // fixed elements already sit at.
  if (spinners.length === 0) {
    return { to, duration: 0, spinning: false, pose: () => [...from.pose] };
  }

  const spinSet = new Set(spinners);
  /** Pull out just the spinning elements' angles, in their formation order. */
  const subset = (pose: number[]) => spinners.map((i) => pose[i] ?? 0);

  // Already turning and asked to keep turning: nothing to change. Spinning
  // elements keep advancing at full speed; non-spinning elements hold still.
  if (to === 'running' && from.spinning) {
    return {
      to,
      duration: 0,
      spinning: true,
      pose: (t) => from.pose.map((angle, i) => (spinSet.has(i) ? angle + speed * t : angle)),
    };
  }

  // Standing still, asked to run: accelerate, opening into the running
  // formation. Every spinning element moves from the first instant; the
  // trailing ones accelerate slower. Non-spinning elements never move.
  if (to === 'running') {
    const wanted = spinners.map((_, order) => formationGap(spinners.length) * order);
    const perSpinner = rampsFor(doc.motion, relativeTravel(lags(subset(from.pose)), wanted, 'accelerating'));
    const duration = Math.max(...perSpinner);
    return {
      to,
      duration,
      spinning: true,
      pose: (t) => {
        const pose = [...from.pose];
        spinners.forEach((i, order) => {
          pose[i] = (from.pose[i] ?? 0) + sweptDegrees(speed, perSpinner[order] ?? 0, t);
        });
        return pose;
      },
    };
  }

  // Turning, asked to stop on a pose. Decelerating closes the formation, but the
  // orientation it lands on is whatever the spinning reached — which would park
  // the logo at an arbitrary angle. So hold full speed for a coast first, chosen
  // as the shortest wait that makes the landing exact. At most a half-turn.
  if (from.spinning) {
    const perSpinner = rampsFor(
      doc.motion,
      relativeTravel(lags(subset(from.pose)), lags(subset(target)), 'decelerating'),
    );
    const leadIndex = spinners[0] ?? 0;
    const leadRamp = perSpinner[0] ?? 0;
    const overshoot = (from.pose[leadIndex] ?? 0) + (speed * leadRamp) / 2;
    const coast = mod180((target[leadIndex] ?? 0) - overshoot) / speed;
    const duration = coast + Math.max(...perSpinner);
    return {
      to,
      duration,
      spinning: false,
      pose: (t) => {
        const pose = [...from.pose];
        spinners.forEach((i, order) => {
          pose[i] =
            (from.pose[i] ?? 0) +
            speed * Math.min(Math.max(t, 0), coast) +
            coastDegrees(speed, perSpinner[order] ?? 0, t - coast);
        });
        return pose;
      },
    };
  }

  // Both poses are still: turn each element the short way onto its target over
  // one shared duration. This runs over every element, spinning or not — a
  // non-spinning element's target always equals its current angle (both are
  // its own fixed angle), so its turn works out to exactly zero and it never
  // moves. Elements with further to go move faster, so everything still starts
  // and stops together with different accelerations.
  const turns = from.pose.map((a, i) => shortestTurn(a, target[i] ?? 0));
  const furthest = Math.max(...turns.map(Math.abs));
  const duration = Math.max(doc.motion.ramp, (2 * furthest) / speed);
  return {
    to,
    duration,
    spinning: false,
    pose: (t) => from.pose.map((a, i) => a + (turns[i] ?? 0) * smootherstep(t / duration)),
  };
}

/** Gaps between neighbouring elements, wrapped at 180. Used by readouts and tests. */
export function separations(pose: number[]): [number, number] {
  const top = pose[0] ?? 0;
  const mid = pose[1] ?? 0;
  const low = pose[2] ?? 0;
  return [leadingGap(top, mid), leadingGap(mid, low)];
}

/**
 * The locked three-stick mark's own running gap, 180° / 3. `rampSpread` and
 * `specStagger` describe *that* mark's spec-derived stagger specifically, not
 * the general N-element formula, so this is pinned rather than read from
 * `formationGap(3)` — the two happen to agree, but nothing here should drift
 * if `formationGap`'s formula ever did.
 */
const THREE_STICK_GAP = 60;

/**
 * How much longer each successive stick's ramp runs when opening the locked
 * three-stick mark from an evenly spaced pose: twice the stagger
 * `Δd = (60 − restSpread) / speed` that the mark spec derived for its earlier
 * staggered-start draft. Starts are simultaneous now, so the same separation
 * comes from a ramp difference of twice the size. Pinned to three elements —
 * the mark spec's own derivation — not generalised to `formationGap(N)`.
 */
export function rampSpread(motion: MotionConfig): number {
  return (2 * (THREE_STICK_GAP - motion.restSpread)) / motion.speed;
}

/** The spec's derived stagger, kept as the readable half of `rampSpread`. */
export function specStagger(motion: MotionConfig): number {
  return (THREE_STICK_GAP - motion.restSpread) / motion.speed;
}
