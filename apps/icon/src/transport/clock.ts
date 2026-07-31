import { CYCLE_MS, TRANSITION_MS } from '../doc/constants';
import type { IconDoc, Sustain } from '../doc/types';
import type { ViewState } from '../view';

/** A transition's duration in seconds, at the document's speed. */
export const transitionSeconds = (doc: IconDoc): number =>
  TRANSITION_MS / 1000 / doc.timing.speed;

/** One turn of a sustained loop, in seconds. */
export const cycleSeconds = (doc: IconDoc): number => CYCLE_MS / 1000 / doc.timing.speed;

export const sustainOf = (doc: IconDoc, stateId: string): Sustain =>
  doc.states.find((state) => state.id === stateId)?.sustain ?? null;

export const anySustained = (doc: IconDoc): boolean =>
  doc.states.some((state) => state.sustain !== null);

/** The first sustained state, which is where the animated exports take motion from. */
export const sustainedState = (doc: IconDoc) => doc.states.find((state) => state.sustain !== null);

/**
 * Whether the transport is showing time with no ends: the state being held is
 * sustained, the transition into it has finished, and motion is on.
 *
 * This one predicate decides everything about the strip's appearance — the
 * rail's caps, whether the fill is a band or a fill, and whether the readout
 * counts to a total or names a cycle.
 */
export const isLooping = (doc: IconDoc, view: ViewState): boolean =>
  !view.reducedMotion && view.t >= 1 && sustainOf(doc, view.to) !== null;

/** How long one pass through every state takes, including each sustained turn. */
export function wholeCycleSeconds(doc: IconDoc): number {
  const transitions = doc.states.length * transitionSeconds(doc);
  const loops = doc.states.filter((state) => state.sustain !== null).length * cycleSeconds(doc);
  return transitions + loops;
}

export interface Readout {
  /** The larger line: where we are. */
  top: string;
  /** The smaller line: what that is out of. */
  bottom: string;
}

/**
 * What the two-line readout says.
 *
 * A transition counts toward a total, because it has two ends. A sustained
 * state names a cycle instead, because it has none — counting `0.62s of ∞`
 * would be a lie about the kind of time being shown.
 */
export function readout(doc: IconDoc, view: ViewState): Readout {
  if (view.reducedMotion) return { top: 'motion off', bottom: 'pose held' };

  if (view.cycling) {
    const index = doc.states.findIndex((state) => state.id === view.to);
    const name = doc.states[index]?.name ?? '';
    return {
      top: `${name} ${index + 1}/${doc.states.length}`,
      bottom: `all states · ${wholeCycleSeconds(doc).toFixed(1)}s`,
    };
  }

  if (isLooping(doc, view)) {
    return {
      top: view.playing ? `${view.loop.toFixed(2)} cycle` : `held ${view.loop.toFixed(2)}`,
      bottom: `${cycleSeconds(doc).toFixed(2)}s loop ↻`,
    };
  }

  const total = transitionSeconds(doc);
  return { top: `${(view.t * total).toFixed(2)}s`, bottom: `of ${total.toFixed(2)}s` };
}

/**
 * Advance the clock by `elapsed` milliseconds.
 *
 * Pure, so the whole transport can be tested without a frame loop. Driven from
 * `requestAnimationFrame` timestamps rather than a fixed interval, so it stays
 * correct when frames are dropped or the display runs at 120Hz — a 16ms
 * assumption would run a 400ms transition at whatever pace the browser felt
 * like.
 */
export function tick(
  doc: IconDoc,
  view: ViewState,
  elapsed: number,
): Pick<ViewState, 't' | 'loop' | 'playing' | 'from' | 'to'> {
  const { from, to, cycling } = view;
  const advance = () => {
    const index = doc.states.findIndex((state) => state.id === to);
    const next = doc.states[(index + 1) % doc.states.length];
    return { from: to, to: next?.id ?? to, t: 0, loop: 0, playing: true };
  };

  if (view.t < 1) {
    const t = view.t + elapsed / (TRANSITION_MS / doc.timing.speed);
    if (t < 1) return { from, to, t, loop: view.loop, playing: true };
    // Arrived. A sustained state now holds and starts looping; a settled one
    // either moves on, if cycling, or stops.
    if (sustainOf(doc, to) !== null) return { from, to, t: 1, loop: 0, playing: true };
    if (cycling) return advance();
    return { from, to, t: 1, loop: 0, playing: false };
  }

  if (sustainOf(doc, to) !== null) {
    const loop = view.loop + elapsed / (CYCLE_MS / doc.timing.speed);
    // One full turn is enough to see; cycling then moves on rather than
    // looping the same state forever and never reaching the rest.
    if (loop >= 1 && cycling) return advance();
    return { from, to, t: 1, loop: loop % 1, playing: true };
  }

  if (cycling) return advance();
  return { from, to, t: 1, loop: view.loop, playing: false };
}
