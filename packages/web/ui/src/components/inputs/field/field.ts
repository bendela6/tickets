import { axis, focusRing, HUES, over, TONE_HUE, variants, type Hue } from '../../../style';
import { CONTROL_LADDER, type ControlSize } from '../control';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

/** Which pseudo-class the focus treatment hangs off — see `focus` below. */
const FOCUS = axis('focus', ['focus', 'focus-within'], 'focus');

/**
 * The shell every text-entry control wears, on the Soft Fill design
 * (2026-08-05, `19 Input Layer FINAL Soft Fill.dc.html`).
 *
 * The model inverted. A field used to be a raised surface with a visible
 * border; it is now a **filled floor with a transparent border**, and focus
 * *lifts* it — the floor drops away to the field surface and the border it was
 * already carrying gets coloured in. Nothing changes size in any state, which
 * is the point of keeping a transparent border at rest rather than adding one
 * on focus.
 *
 * The six recipes, from the design's contract table:
 *
 *   rest      floor rung 4 · 1px transparent border · no shadow
 *   hover     floor rung 5 · 120ms
 *   focus     floor surface · rim rung 11 light / 9 dark · halo 4px @22/30%
 *   active    floor rung 6 · inset well, held until a popup opens
 *   disabled  45° hatch rung 4/7 · value rung 9 · no tab stop
 *   read-only NO floor · 1px rule rung 7 · value stays rung 12 · keeps tab stop
 *
 * `state` is what a tone means to a field, and under Soft Fill the answer is
 * "the floor swaps ramp, everything else holds":
 *
 *   neutral — the resting field, on GRAY rung 4. An input with nothing to say
 *             about itself is not coloured. Gray needs rung 4 to register at
 *             all, which is why it does not share the toned rung.
 *   toned   — the field is saying something, on its own ramp's rung 2. Two
 *             rungs lower than neutral because a saturated ramp carries at a
 *             lighter step, and a form of rung-4 colour would shout.
 *
 * A toned field keeps its own ramp on focus rather than reverting to the
 * accent — an invalid field that turns indigo the moment you click into it has
 * hidden the error exactly when you need it. `focusRing` takes the ramp, so
 * that falls out rather than being special-cased.
 *
 * `focus` is the *variant prefix*: a plain `<input>` takes focus itself, while
 * a composite field (a tag list, a stepper) focuses an inner element and has to
 * react to `focus-within`.
 */
export const fieldClass = variants({
  base: [
    'appearance-none font-sans text-gray-12 placeholder:text-gray-10',
    // The border is present and transparent from rest, so the focus rim costs
    // no layout. Removing it and adding one on focus would shift the value by
    // a pixel every time the caret lands.
    'border-1 border-transparent',
    'transition-colors duration-120',
    // Disabled is a hatch, not a tint — a filled floor cannot say "unavailable"
    // by going one rung quieter, because every other state is also a floor.
    // `cursor-default`, never `not-allowed`. The barred circle reads as a
    // refusal aimed at the person rather than a statement about the field, and
    // it says the same thing over a permanently-inapplicable control as over a
    // temporarily-locked one. Read-only already uses `cursor-default` for the
    // same reason; disabled now matches it.
    'disabled:bg-hatch disabled:text-gray-9 disabled:cursor-default',
  ],
  config: {
    state: {
      default: 'neutral',
      options: {
        neutral: over(SCALE, FOCUS, (tone, focus) => [
          'bg-gray-4 hover:bg-gray-5 active:bg-gray-6',
          `${focus}:bg-surface-field`,
          focusRing(tone, focus),
        ]),
        toned: over(SCALE, FOCUS, (tone, focus) => [
          `bg-${tone}-2 hover:bg-${tone}-3 active:bg-${tone}-4`,
          `${focus}:bg-surface-field`,
          focusRing(tone, focus),
        ]),
      },
    },
    // Height, radius, padding and font size now move together — the design
    // states one set of ratios and `CONTROL_LADDER` is that table. They used to
    // be deliberately split, back when a 36px input was 14px and a 36px
    // combobox 13px for no reason the spec gave; Soft Fill settles it.
    size: {
      default: 'md',
      options: {
        xs: `${CONTROL_LADDER.xs.height} ${CONTROL_LADDER.xs.radius} ${CONTROL_LADDER.xs.text} ${CONTROL_LADDER.xs.padX}`,
        md: `${CONTROL_LADDER.md.height} ${CONTROL_LADDER.md.radius} ${CONTROL_LADDER.md.text} ${CONTROL_LADDER.md.padX}`,
        lg: `${CONTROL_LADDER.lg.height} ${CONTROL_LADDER.lg.radius} ${CONTROL_LADDER.lg.text} ${CONTROL_LADDER.lg.padX}`,
      },
    },
  },
});

/**
 * What a field should pass to `fieldClass` for a given `tone` prop.
 *
 * An unset tone is the resting field; any tone the caller names is a statement
 * the field is making about itself, so it wears that ramp. `danger` is the one
 * with semantics beyond colour — it is what `aria-invalid` announces — so it is
 * reported separately rather than inferred downstream.
 */
export function fieldState(tone: string | undefined): {
  state: 'neutral' | 'toned';
  /** Named for the `scale` variants axis it feeds; the value is a ramp name,
   *  which `TONE_HUE` now says at the source. Typed `Hue` rather than
   *  `string` — as `string` a tone name could pass through and build the
   *  colourless `bg-primary-9`. */
  scale: Hue;
  invalid: boolean;
} {
  const resolved = (tone ?? 'primary') as keyof typeof TONE_HUE;
  return {
    state: tone === undefined ? 'neutral' : 'toned',
    scale: TONE_HUE[resolved] ?? TONE_HUE.primary,
    invalid: tone === 'danger',
  };
}

/** Re-exported so a control that needs one rung of the ladder does not reach
 *  past this module for it. */
export { CONTROL_LADDER, type ControlSize };
