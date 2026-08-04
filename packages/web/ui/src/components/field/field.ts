import { axis, HUES, over, TONE_HUE, variants, type Hue } from '../../style';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUES, 'indigo');

export type FieldSize = 'sm' | 'md' | 'lg';

/** Which pseudo-class the focus treatment hangs off — see `focus` below. */
const FOCUS = axis('focus', ['focus', 'focus-within'], 'focus');

/**
 * The shell every text-entry control wears: surface fill, a border that reacts
 * to hover and focus, and the disabled treatment. Seven components used to
 * carry their own copy of it, which is how five of them ended up with the
 * accent hardcoded to indigo.
 *
 * `state` is what a tone means to a field:
 *
 *   neutral — the resting field. Gray border, accent focus ring. An input with
 *             nothing to say about itself is not coloured, so this stays the
 *             default; making every field wear its tone's border would paint
 *             the whole form indigo.
 *   toned   — the field is saying something. Border and ring both take the
 *             ramp, and the border is on whether or not it has focus, because
 *             an error or a confirmation has to be visible at a glance.
 *
 * `focus` is the *variant prefix*: a plain `<input>` takes focus itself, while
 * a composite field (a tag list, a stepper) focuses an inner element and has
 * to react to `focus-within`. A toned field keeps its own colour on focus
 * rather than reverting to the accent — an invalid field that turns indigo the
 * moment you click into it has hidden the error exactly when you need it.
 */
export const fieldClass = variants({
  base: [
    'appearance-none border-1 bg-surface-raised font-sans text-gray-12 placeholder:text-gray-9',
    'transition-colors',
    'disabled:border-gray-6 disabled:bg-surface-inset disabled:text-gray-9',
  ],
  config: {
    state: {
      default: 'neutral',
      // Two axes: the ramp, and which pseudo-class the focus treatment hangs
      // off. `ring()` is not reachable here — it is pinned to `focus-visible`,
      // and a field's whole point is that the trigger varies.
      options: {
        neutral: over(SCALE, FOCUS, (tone, focus) => [
          'border-gray-7 hover:border-gray-9',
          `${focus}:border-${tone}-9 ${focus}:outline-none`,
          `${focus}:ring-3 ${focus}:ring-${tone}-3`,
        ]),
        toned: over(SCALE, FOCUS, (tone, focus) => [
          `border-${tone}-9 hover:border-${tone}-10`,
          `ring-3 ring-${tone}-3 ${focus}:outline-none`,
        ]),
      },
    },
    // Height and radius only — deliberately not padding or font-size.
    // A stepper, a tag list and a plain input want different insets at the same
    // height, and their font sizes genuinely differ today (Input is 14px, the
    // comboboxes are text-13/19 at 13px) with nothing in the spec saying they
    // should not. Folding either in here would change appearance under cover
    // of a refactor. Radius IS shared: design-system.html §07 puts the 36px
    // combobox trigger at 8px, same as the input.
    size: {
      default: 'md',
      options: {
        sm: 'h-28 rounded-md',
        md: 'h-36 rounded-lg',
        lg: 'h-44 rounded-xl',
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
