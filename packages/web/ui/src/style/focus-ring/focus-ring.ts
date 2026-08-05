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
 * 1.5px of ring, held 1px off the control.
 *
 * The width is an arbitrary length, against the usual house rule, because
 * Tailwind's `ring-<number>` only accepts integers — `ring-1.5` parses as
 * nothing, compiles to nothing, and leaves the control with no ring at all
 * while every other class on it still looks right. There is no 1.5 rung to
 * reach for instead.
 */
const WIDTH = '[1.5px]';
const OFFSET = 1;

/**
 * What the 1px gap is painted with — and it MUST be painted. Tailwind's
 * `--tw-ring-offset-color` defaults to white, so an offset ring with no colour
 * named draws a white hairline around every control in the dark theme.
 *
 * `surface-raised` is what sits behind a control on a card, a panel or a table
 * row, which is where they nearly all live (measured: the painted ancestor of a
 * field in the gallery is `#252320`, this token). A control dropped straight
 * onto the page ground or into an inset well would show a faint 1px seam here;
 * that is the trade for a gap that works without a per-surface variable.
 */
const OFFSET_SURFACE = 'surface-raised';

/**
 * `-11`. The only rung that is bold on the ground in BOTH themes (7.1–11.3:1
 * dark, 8.0–10.3:1 light) AND still legible on the mark controls, which fill
 * `-9` when checked — a `-9` ring on a `-9` fill is 1.00:1, so focus would read
 * as the box merely growing. Against `-9`, `-11` is 1.4:1.
 */
const RUNG = 11;

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
    `${on}:ring-${WIDTH}`,
    `${on}:ring-${hue}-${RUNG}`,
    `${on}:ring-offset-${OFFSET}`,
    `${on}:ring-offset-${OFFSET_SURFACE}`,
  ].join(' ');
}
