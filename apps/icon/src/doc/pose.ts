import {
  LOOP_FADE_PERCENT,
  LOOP_MIN_OPACITY,
  LOOP_MOVE_UNITS,
  LOOP_SPIN_DEGREES,
  REFERENCE_SIZE,
  SUSTAIN_AMPLITUDE,
  TRANSITION_FADE_PERCENT,
  TRANSITION_MOVE_UNITS,
  TRANSITION_SPIN_DEGREES,
} from './constants';
import { translate } from './geometry';
import type { IconDoc, IconObject, PosedObject, Ramp, Sustain } from './types';

/**
 * A state's position along the single motion parameter every pose is derived
 * from.
 *
 * States are named, not numbered — the design has no control that sets this —
 * so phase comes from order alone: the first state is 0, the last is 1, the
 * rest divide evenly. One state is phase 0, which is what makes a purely
 * static icon a legal document rather than a special case.
 */
export function phaseOf(states: readonly { id: string }[], stateId: string): number {
  const index = states.findIndex((state) => state.id === stateId);
  if (index < 0 || states.length < 2) return 0;
  return index / (states.length - 1);
}

/** How sharply motion starts and stops. Three named ramps, never a curve editor. */
export function ease(ramp: Ramp, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (ramp) {
    case 'linear':
      return clamped;
    case 'soft':
      return clamped * clamped * (3 - 2 * clamped);
    case 'sharp':
      return clamped < 0.5
        ? 4 * clamped * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
  }
}

/**
 * Where the transition currently is, as a phase.
 *
 * `t` is progress through the move from `from` to `to`; easing is applied to
 * `t` and not to the phase, so a transition between two adjacent states and
 * one that skips a state ramp identically.
 */
export function transitionPhase(
  doc: IconDoc,
  fromId: string,
  toId: string,
  t: number,
): number {
  const a = phaseOf(doc.states, fromId);
  const b = phaseOf(doc.states, toId);
  return a + (b - a) * ease(doc.timing.ramp, t);
}

export interface Moment {
  /** The state the transition is leaving. */
  from: string;
  /** The state it is arriving at, and the one held once `t` reaches 1. */
  to: string;
  /** Progress through the transition, 0–1. */
  t: number;
  /**
   * Position around a sustained loop, 0–1, or null when nothing is looping —
   * either the state is settled, the transition has not finished, or motion is
   * off. A reduced-motion preview always passes null.
   */
  loop: number | null;
}

/**
 * The pose of one object at one moment.
 *
 * Distances are stated on a 512 board and scale with the artboard, so the same
 * document animates the same shape of motion at any size.
 */
export function poseObject(
  object: IconObject,
  doc: IconDoc,
  phase: number,
  moment: Pick<Moment, 'loop'>,
  sustain: Sustain,
  index: number,
): PosedObject {
  if (!object.motion.takesPart) return object;

  const scale = doc.size / REFERENCE_SIZE;
  const { role, pace } = object.motion;

  let rotation = object.rotation;
  let opacity = object.opacity;
  let dy = 0;

  if (role === 'spins') {
    rotation = Math.round(object.rotation + TRANSITION_SPIN_DEGREES * phase * pace) % 360;
  }
  if (role === 'moves') dy += TRANSITION_MOVE_UNITS * scale * phase;
  if (role === 'fades') opacity = Math.round(object.opacity - TRANSITION_FADE_PERCENT * phase);

  if (moment.loop !== null && sustain !== null) {
    const amplitude = SUSTAIN_AMPLITUDE[sustain][role];
    // Rest spread pushes each object's pause a little further round the cycle
    // than the last, so they never all stop at the same instant.
    const cyclePhase = (moment.loop - index * doc.timing.rest) * pace;
    const wave = 2 * Math.PI * cyclePhase;
    if (role === 'spins') {
      rotation = Math.round(rotation + LOOP_SPIN_DEGREES * cyclePhase * amplitude) % 360;
    }
    if (role === 'moves') dy += LOOP_MOVE_UNITS * scale * amplitude * Math.sin(wave);
    if (role === 'fades') {
      opacity = Math.round(
        opacity - LOOP_FADE_PERCENT * amplitude * (0.5 - 0.5 * Math.cos(wave)),
      );
    }
  }

  return {
    ...object,
    rotation,
    opacity: Math.max(LOOP_MIN_OPACITY, Math.min(100, opacity)),
    geometry: dy === 0 ? object.geometry : translate(object.geometry, 0, Math.round(dy)),
  };
}

function sustainOf(doc: IconDoc, stateId: string): Sustain {
  return doc.states.find((state) => state.id === stateId)?.sustain ?? null;
}

/**
 * Every object posed for one moment, in document order.
 *
 * A loop only runs once the transition into the state has finished — a state
 * cannot be both arriving and sustaining.
 */
export function poseAll(doc: IconDoc, moment: Moment): PosedObject[] {
  const phase = transitionPhase(doc, moment.from, moment.to, moment.t);
  const sustain = sustainOf(doc, moment.to);
  const loop = sustain !== null && moment.t >= 1 ? moment.loop : null;
  return doc.objects.map((object, index) =>
    poseObject(object, doc, phase, { loop }, sustain, index),
  );
}

/**
 * Every object posed as the named state holds it, with no transition running.
 *
 * A sustained state resolves to the pose it *enters* the loop at — phase 0,
 * never a mid-loop frame — so the held result is deterministic rather than
 * whatever frame the loop happened to have reached. This is what the reduced-
 * motion strip and every static export capture.
 */
export function poseAtState(doc: IconDoc, stateId: string): PosedObject[] {
  const phase = phaseOf(doc.states, stateId);
  return doc.objects.map((object, index) =>
    poseObject(object, doc, phase, { loop: null }, null, index),
  );
}

/**
 * The objects that take part, in running order — fastest first. Pace IS the
 * order, so this is the whole of it.
 */
export function runningOrder(doc: IconDoc): IconObject[] {
  return doc.objects
    .filter((object) => object.motion.takesPart)
    .sort((a, b) => b.motion.pace - a.motion.pace);
}

/**
 * The sentence under the pace control, naming who leads and who follows.
 * Returns null when the object takes no part and there is nothing to say.
 */
export function paceHint(doc: IconDoc, objectId: string): string | null {
  const order = runningOrder(doc);
  const rank = order.findIndex((object) => object.id === objectId);
  if (rank < 0) return null;
  if (order.length < 2) return 'the only object in the animation';
  if (rank === 0) {
    return `leads — ${order
      .slice(1)
      .map((object) => object.name)
      .join(', ')} follow`;
  }
  const before = order[rank - 1];
  if (!before) return null;
  if (rank === order.length - 1) return `resolves last, after ${before.name}`;
  return `follows ${before.name}`;
}
