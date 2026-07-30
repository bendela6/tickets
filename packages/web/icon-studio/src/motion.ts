import type { MarkConfig, MotionConfig } from './config';

/**
 * The loader's maths. Every function here is closed-form: a pose is computed
 * from a time, never integrated frame by frame. That is what keeps the
 * formation exact — a per-frame integrator accumulates drift and needs a snap
 * at the end of each transition to hide it, and the snap is visible.
 *
 * **The three sticks start together and accelerate differently.** Past its ramp
 * a stick has given up exactly half a ramp's worth of distance to accelerating,
 * so two sticks sharing a top speed end up permanently `speed × (Rᵢ − R₀) / 2`
 * apart. Their separation is therefore set by the *difference in their ramps*,
 * with no staggered starts involved: the stick with furthest to travel
 * accelerates slowest and trails, which is what opens the mark into an asterisk.
 */

/** Degrees between neighbouring sticks while running: a rigid three-armed asterisk. */
export const ASTERISK_GAP = 60;

export type Phase = 'idle' | 'spin-up' | 'running' | 'spin-down';
export const PHASES: readonly Phase[] = ['idle', 'spin-up', 'running', 'spin-down'];

type Triple = [number, number, number];

function triple(values: number[]): Triple {
  const [a, b, c] = values;
  return [a ?? 0, b ?? 0, c ?? 0];
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
 * Degrees swept by a stick that ramps 0 → `speed` over `ramp` seconds on
 * smootherstep, `elapsed` seconds after it started.
 *
 * This is the exact integral of `speed * smootherstep(t / ramp)`. Past the ramp
 * the stick is at full speed, having lost exactly half a ramp's worth of
 * distance to the acceleration — the term that turns a difference in ramps into
 * a fixed separation.
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
 * A stick is a full diameter, so it looks identical at θ and θ+180 — the
 * distance one stick sits behind another wraps at 180, not 360.
 */
function leadingGap(ahead: number, behind: number): number {
  return (((ahead - behind) % 180) + 180) % 180;
}

/** The angles the loader rests on, in `top, mid, low` order. */
export function restAngles(config: MarkConfig): Triple {
  const [top, mid, low] = config.angles;
  if (config.motion.restPose === 'logo') return [top, mid, low];
  const { restSpread } = config.motion;
  return [top, top - restSpread, top - 2 * restSpread];
}

/**
 * Each stick's ramp length, in seconds. All three start at once; these are what
 * differ.
 *
 * Derived, not dialled. Stick `i` has to fall exactly `60i` behind the leader,
 * minus however far behind it already sits at rest. Since a ramp costs a stick
 * `speed × ramp / 2` of distance, buying `60i − gap` degrees of lag takes
 * `2 × (60i − gap) / speed` extra seconds of ramp. The shortest ramp is the
 * configured one and the others grow from it, so `motion.ramp` stays a value
 * you can feel: it is the leading stick's acceleration.
 */
export function ramps(config: MarkConfig): Triple {
  const { speed, ramp } = config.motion;
  const rest = restAngles(config);
  const [lead] = rest;
  const extra = rest.map((angle, i) => (2 * (ASTERISK_GAP * i - leadingGap(lead, angle))) / speed);
  // A pose whose angles run the other way would want a negative ramp; shifting
  // by the smallest keeps every ramp real, and only the differences matter.
  const smallest = Math.min(...extra);
  return triple(extra.map((e) => ramp + e - smallest));
}

/** How long a spin-up or spin-down runs: until the slowest stick finishes its ramp. */
export function transitionSeconds(config: MarkConfig): number {
  return Math.max(...ramps(config));
}

/** Sticks opening from the rest pose out to the asterisk. */
export function spinUpPose(config: MarkConfig, t: number): Triple {
  const { speed } = config.motion;
  const rest = restAngles(config);
  const perStick = ramps(config);
  return triple(rest.map((angle, i) => angle + sweptDegrees(speed, perStick[i] ?? 0, t)));
}

/**
 * The rigid asterisk, turning. Spin-up has already landed the formation by
 * `transitionSeconds`, so running is simply spin-up continued — one model, and
 * no seam where a second one would take over.
 */
export function runningPose(config: MarkConfig, t: number): Triple {
  return spinUpPose(config, transitionSeconds(config) + t);
}

/**
 * Folding shut. Every stick begins decelerating at once, over its own ramp, so
 * the trailing sticks — which ramp for longer — cover more ground and close on
 * the leader. That extra distance is exactly the gap each needs to shut, so the
 * mark lands back on the rest pose without being told to. The top stick, on the
 * shortest ramp, stops first.
 */
export function spinDownPose(config: MarkConfig, t: number): Triple {
  const { speed } = config.motion;
  const perStick = ramps(config);
  const settled = runningPose(config, 0);
  return triple(settled.map((angle, i) => angle + coastDegrees(speed, perStick[i] ?? 0, t)));
}

/** Seconds the idle and running phases hold for when the preview cycles by itself. */
export const IDLE_HOLD = 0.8;
export const RUNNING_HOLD = 1.8;

/**
 * How long running holds, stretched so that one whole cycle turns the mark an
 * exact number of half-turns.
 *
 * Spin-down folds back onto the rest pose's *shape*, but its orientation is
 * wherever the spinning left it — for the `logo` pose that would park the logo
 * at an arbitrary angle, and looping would visibly jump. A stick is a full
 * diameter and so identical every 180°, so making the cycle's total rotation
 * `speed × (transition + hold)` a multiple of 180 lands the mark back on its
 * own orientation. Running is the one phase whose length carries no meaning, so
 * it absorbs the correction; the ramp, which is a designed feel, does not.
 * Never shorter than `RUNNING_HOLD`.
 */
export function runningHoldSeconds(config: MarkConfig): number {
  const { speed } = config.motion;
  const transition = transitionSeconds(config);
  const halfTurns = Math.ceil((speed * (transition + RUNNING_HOLD)) / 180);
  return (halfTurns * 180) / speed - transition;
}

/** Where the self-cycling preview is at time `t`, and how long one loop takes. */
export function cycleLength(config: MarkConfig): number {
  return IDLE_HOLD + transitionSeconds(config) * 2 + runningHoldSeconds(config);
}

export function cyclePhaseAt(config: MarkConfig, t: number): { phase: Phase; local: number } {
  const transition = transitionSeconds(config);
  const length = cycleLength(config);
  let local = ((t % length) + length) % length;
  if (local < IDLE_HOLD) return { phase: 'idle', local };
  local -= IDLE_HOLD;
  if (local < transition) return { phase: 'spin-up', local };
  local -= transition;
  const running = runningHoldSeconds(config);
  if (local < running) return { phase: 'running', local };
  local -= running;
  return { phase: 'spin-down', local };
}

/**
 * The pose for any phase at any time. Named phases hold at their end — spin-up
 * settles on the asterisk and stays there — so a paused control still shows
 * where that phase leaves the mark.
 */
export function poseAt(config: MarkConfig, phase: Phase, t: number): Triple {
  const transition = transitionSeconds(config);
  switch (phase) {
    case 'idle':
      return restAngles(config);
    case 'spin-up':
      return spinUpPose(config, Math.min(t, transition));
    case 'running':
      return runningPose(config, t);
    case 'spin-down':
      return spinDownPose(config, Math.min(t, transition));
  }
}

/**
 * The cycling preview's pose. Spin-down is carried forward by however far
 * running turned the mark, because `spinDownPose` starts from the settled
 * asterisk rather than from wherever the spinning got to — without the carry
 * the mark would snap back at the handover.
 */
export function cyclePose(config: MarkConfig, t: number): Triple {
  const { phase, local } = cyclePhaseAt(config, t);
  if (phase !== 'spin-down') return poseAt(config, phase, local);
  const carried = config.motion.speed * runningHoldSeconds(config);
  return triple(
    spinDownPose(config, Math.min(local, transitionSeconds(config))).map((a) => a + carried),
  );
}

/** Gaps between neighbouring sticks, wrapped at 180. Used by the readouts and the tests. */
export function separations(pose: Triple): [number, number] {
  const [top, mid, low] = pose;
  return [leadingGap(top, mid), leadingGap(mid, low)];
}

/**
 * How much longer each successive stick's ramp runs, on an evenly-spaced rest
 * pose: twice the spec's derived stagger `Δd = (60 − restSpread) / speed`.
 * Starts are simultaneous now, so what the spec expressed as a delay shows up
 * here as the ramp difference that produces the same separation.
 */
export function rampSpread(motion: MotionConfig): number {
  return (2 * (ASTERISK_GAP - motion.restSpread)) / motion.speed;
}

/** The spec's derived stagger, kept as the readable half of `rampSpread`. */
export function specStagger(motion: MotionConfig): number {
  return (ASTERISK_GAP - motion.restSpread) / motion.speed;
}
