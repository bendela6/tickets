import { axis, type Axis } from '../variants/axis';
import { HUE_TONES, TONE_SCALE, type HueTone } from './tones.generated';

/**
 * The tone axis, surfaced as a `scale` prop, varying over the bare scale name.
 * A call site combines it with the rung it wants — `bg-${tone}-3` — so the
 * class it produces is readable in place rather than assembled from a handle.
 *
 * Rung numbers ARE the vocabulary here: 1-2 page backgrounds, 3-5 component
 * fills, 6-8 borders, 9-10 solid fills, 11-12 text. That ladder is documented
 * on the Colors page and holds for every scale, which is what makes a number
 * at a call site legible instead of arbitrary.
 *
 * The trade this accepts: re-anchoring a job (moving a subtle fill from 3 to
 * 2) is a sweep across call sites rather than one line in tones.tokens.json,
 * and nothing lints for it. The safelist snapshot is the backstop — every
 * class these produce is enumerated into it, so an unintended change shows up
 * as a diff there.
 */
export const SCALE: Axis<'scale', HueTone> = axis(
  'scale',
  HUE_TONES,
  TONE_SCALE.primary,
);

/** The tone axis with a different resting scale — Pill rests on neutral. */
export function scaleAxis(fallback: HueTone): Axis<'scale', HueTone> {
  return axis('scale', HUE_TONES, fallback);
}

/**
 * The focus halo. Not a rung — three classes, one of which is a ring WIDTH —
 * so it stays a function even though the rungs no longer do. Nine hand-written
 * copies across button/field/switch/toggle differed only in the scale; this is
 * the one place `ring-3` is spelled.
 */
export function ring(tone: HueTone): string {
  return `focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-${tone}-3`;
}
