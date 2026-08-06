import { axis, focusRing, HUES, over, TONE_HUE, variants, type Hue } from '../../../../style';
import { CONTROL_LADDER, type ControlSize, disabledClass } from '../../contract';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

/**
 * Which pseudo-class the focus treatment hangs off — see `focus` below.
 *
 * Three, and the choice is not cosmetic. `21 Input Interactions`: "Triggers use
 * `:focus-visible` — clicking one leaves no ring, tabbing to it does. Text
 * fields ring on click too, via `:focus-within`, because a clicked text field
 * genuinely holds the caret and hiding that would be the bug."
 */
const FOCUS = axis('focus', ['focus', 'focus-within', 'focus-visible'], 'focus');

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
    // Rung 11, not 10: the design moved the hint up for contrast — 5.38:1 light
    // and 5.47:1 dark, where rung 10 measured 3.8:1.
    'appearance-none font-sans text-gray-12 placeholder:text-gray-11',
    // The border is present and transparent from rest, so the rim costs no
    // layout. Removing it and adding one later would shift the value by a pixel
    // every time the state changed.
    'border-1 border-transparent',
    // The bordered escape hatch, from `19 Soft Fill Library`: "A rimless fill
    // measures ~1.2:1 against the card, which is below WCAG 1.4.11's 3:1
    // boundary threshold. Ship a bordered escape hatch […] and switch to it
    // automatically under prefers-contrast: more and forced-colors: active.
    // Focus, tone and disabled all already clear 3:1, so this is the only gap."
    //
    // The whole Soft Fill idea is that a resting field has no edge, and that is
    // the one thing it cannot offer someone who needs boundaries drawn. Rather
    // than compromise the default, the rim comes back when the platform says it
    // is wanted — which is also the only honest reading of a user preference.
    'contrast-more:border-gray-7 forced-colors:border-gray-7',
    'transition-colors duration-120',
    // Disabled fades the WHOLE control — chrome and value together — rather
    // than restyling it. The 45° hatch this replaced said "unavailable" loudly
    // but also redrew the field as something that was never a field, and it
    // could not be applied to a mark or a swatch without inventing a second
    // treatment. Opacity applies to anything.
    //
    // `cursor-default`, never `not-allowed`: the barred circle reads as a
    // refusal aimed at the person rather than a statement about the field.
    disabledClass,
  ],
  config: {
    state: {
      default: 'neutral',
      options: {
        // Every interactive state now moves the floor AND the rim together.
        // The design's reason is measured: the warm neutral ramp moves only
        // 1.06:1 between adjacent fill rungs, so a floor change alone cannot
        // carry a state — which is exactly the invisible-hover defect this
        // library already had once, fixed there by a rung nudge and fixed here
        // structurally.
        neutral: over(SCALE, FOCUS, (tone, focus) => [
          'bg-gray-5 hover:bg-gray-6 active:bg-gray-7',
          'hover:border-gray-9 active:border-gray-10',
          `${focus}:bg-surface-field`,
          focusRing(tone, focus),
        ]),
        toned: over(SCALE, FOCUS, (tone, focus) => [
          // A toned field is the ONE place a resting field is bordered: the
          // rung-6 hairline is how it reads as toned before you reach its
          // glyph. Unset stays rimless, which is what keeps a stacked form free
          // of rim noise.
          `bg-${tone}-2 border-${tone}-6`,
          `hover:bg-${tone}-3 hover:border-${tone}-9`,
          `active:bg-${tone}-4 active:border-${tone}-10`,
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
