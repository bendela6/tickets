import { axis, over, TONE, TONE_SCALE, variants, type HueTone } from '../../style';

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
    'appearance-none border bg-surface-raised font-sans text-gray-12 placeholder:text-gray-9',
    'transition-colors',
    'disabled:border-gray-6 disabled:bg-surface-inset disabled:text-gray-9',
  ],
  config: {
    state: {
      default: 'neutral',
      // Two axes: the ramp, and which pseudo-class the focus treatment hangs
      // off. `t.ring` is not reachable here — it is pinned to `focus-visible`,
      // and a field's whole point is that the trigger varies.
      options: {
        neutral: over(TONE, FOCUS, (t, focus) => [
          'border-gray-7 hover:border-gray-9',
          `${focus}:border-${t.solid} ${focus}:outline-none`,
          `${focus}:ring-[3px] ${focus}:ring-${t.focusRing}`,
        ]),
        toned: over(TONE, FOCUS, (t, focus) => [
          `border-${t.solid} hover:border-${t.solidHover}`,
          `ring-[3px] ring-${t.focusRing} ${focus}:outline-none`,
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
        sm: 'h-7 rounded-[6px]',
        md: 'h-9 rounded-[8px]',
        lg: 'h-11 rounded-[10px]',
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
  /** A ramp name, not a tone name — `primary` paints from `indigo`. Narrowed
   *  to the ramp domain because that is what the `scale` axis accepts; it used
   *  to be `string`, which let a tone name through to build `bg-primary-9`. */
  scale: HueTone;
  invalid: boolean;
} {
  const resolved = (tone ?? 'primary') as keyof typeof TONE_SCALE;
  return {
    state: tone === undefined ? 'neutral' : 'toned',
    scale: TONE_SCALE[resolved] ?? TONE_SCALE.primary,
    invalid: tone === 'danger',
  };
}
