import { axis, type Axis } from '../variants/axis';
import { HUE_TONES, STEP, TONE_SCALE, type HueTone } from './tones.generated';

/**
 * One ramp with its rungs already resolved: `solid` is `indigo-9`, not `9`.
 *
 * Every key is named after its `STEP` rung, so a call site still says which
 * rung it means — the whole point of the step contract is that nobody writes
 * `-9` — while the `${scale}-${STEP.x}` ceremony happens once, here.
 */
export type Ramp = { readonly name: HueTone } & {
  readonly [Rung in keyof typeof STEP]: string;
} & {
  /**
   * The focus affordance itself, not a rung. Nine hand-written copies of this
   * across button/field/switch/toggle differed only in the trigger; this is
   * also the one place `ring-[3px]` needs replacing when it becomes a token.
   */
  readonly ring: string;
};

function build(name: HueTone): Ramp {
  const rungs = Object.fromEntries(
    Object.entries(STEP).map(([rung, step]) => [rung, `${name}-${step}`]),
  ) as { [Rung in keyof typeof STEP]: string };
  return {
    name,
    ...rungs,
    ring: `focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-${name}-${STEP.focusRing}`,
  };
}

/** Every ramp, keyed by hue — the domain the `TONE` axis varies over. */
export const RAMPS: Record<HueTone, Ramp> = Object.fromEntries(
  HUE_TONES.map((hue) => [hue, build(hue)]),
) as Record<HueTone, Ramp>;

/**
 * The tone axis, surfaced as a `scale` prop. Declared once so no component can
 * narrow the domain or spell it differently; the only per-component decision
 * left is which ramp to fall back to, via `tonedAxis`.
 */
export const TONE: Axis<'scale', HueTone, Ramp> = axis('scale', RAMPS, TONE_SCALE.primary);

/** The tone axis with a different resting ramp — Pill rests on neutral. */
export function toneAxis(fallback: HueTone): Axis<'scale', HueTone, Ramp> {
  return axis('scale', RAMPS, fallback);
}
