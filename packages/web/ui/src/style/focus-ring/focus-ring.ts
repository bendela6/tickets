import type { Hue } from '../tones';

/**
 * The focus ring, defined once.
 *
 * Six components used to spell this out themselves, which is how all six ended
 * up wearing a ring nobody could see: the rung was `-3`, a near-background fill
 * tint that measures 1.00:1 against the dark ground and 1.20:1 against the
 * light one — far under the 3:1 WCAG 2.2 asks of a focus indicator. Changing it
 * meant finding six copies. Now it is these two constants.
 *
 * Which pseudo-class the ring hangs off is the caller's to say, and it is the
 * one thing that genuinely differs between them:
 *
 *   focus-visible — the default, and right for anything you click AND tab to
 *                   (a button, a checkbox); it keeps the ring off on click.
 *   focus         — a plain text field, which should ring whenever it has the
 *                   caret, however the caret got there.
 *   focus-within  — a composite field (a tag list, a stepper) whose shell never
 *                   matches `:focus` because an inner element takes it.
 */

/**
 * A 4px halo, and a 1px rim drawn as the control's own border.
 *
 * The Soft Fill design (2026-08-05) states focus as "1px rim rung 11 light / 9
 * dark · halo 4px @22%". The rim is a border rather than a second ring because
 * a Soft Fill control rests with a *transparent* border it can colour in — the
 * geometry never changes between rest and focus, so nothing reflows.
 *
 * The rung flips by theme because the ramps do: rung 11 is the readable step on
 * a light ground and rung 9 on a dark one. The halo takes rung 9 in both and
 * varies its alpha instead, 22% light / 30% dark, because a translucent wash
 * needs more weight to register against a dark ground.
 */
const HALO = 4;
const RIM_LIGHT = 11;
const RIM_DARK = 9;
const HALO_RUNG = 9;
const HALO_ALPHA_LIGHT = 22;
const HALO_ALPHA_DARK = 30;

export const FOCUS_TRIGGERS = ['focus', 'focus-visible', 'focus-within'] as const;
export type FocusTrigger = (typeof FOCUS_TRIGGERS)[number];

/**
 * Every control's focus treatment. Pass the ramp it paints from; pass a trigger
 * when the default is wrong.
 *
 * Returns a plain string so it composes inside a `variants()` config, which is
 * what lets the safelist extractor see the interpolated classes.
 */
export function focusRing(hue: Hue, on: FocusTrigger = 'focus-visible'): string {
  return [
    `${on}:outline-none`,
    // The rim. Paints the transparent border a Soft Fill control already has.
    `${on}:border-${hue}-${RIM_LIGHT}`,
    `dark:${on}:border-${hue}-${RIM_DARK}`,
    // The halo.
    `${on}:ring-${HALO}`,
    `${on}:ring-${hue}-${HALO_RUNG}/${HALO_ALPHA_LIGHT}`,
    `dark:${on}:ring-${hue}-${HALO_RUNG}/${HALO_ALPHA_DARK}`,
  ].join(' ');
}
