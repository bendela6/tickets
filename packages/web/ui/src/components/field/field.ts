import { HUE_TONES, STEP, TONE_SCALE, variants } from '../../style';

// The shell every text-entry control wears: surface fill, a border that reacts
// to hover and focus, and the disabled treatment. Seven components used to
// carry their own copy of it, which is how five of them ended up with the
// accent hardcoded to indigo.
//
// Invalid is always the danger ramp — that is what "invalid" means — but it
// reads the ramp out of the semantic map rather than writing `red`, so
// re-pointing `danger` moves every field with it.
const DANGER = TONE_SCALE.danger;

export const fieldClass = variants({
  base: [
    'appearance-none border bg-surface-raised font-sans text-gray-12 placeholder:text-gray-9',
    'transition-colors',
    'disabled:border-gray-6 disabled:bg-surface-inset disabled:text-gray-9',
  ],
  config: {
    // Focus belongs to `state`, not beside it: an invalid field keeps its red
    // ring when focused rather than turning accent-colored, so the two cannot
    // be chosen independently. `focus` is the *variant prefix* — a plain
    // `<input>` takes focus itself, while a composite field (a tag list, a
    // stepper) focuses an inner element and has to react to `focus-within`.
    state: {
      default: 'idle',
      params: {
        scale: { default: TONE_SCALE.primary, values: HUE_TONES },
        focus: { default: 'focus', values: ['focus', 'focus-within'] },
      },
      options: ({ scale, focus }: { scale?: string; focus?: 'focus' | 'focus-within' }) => ({
        idle: [
          'border-gray-7 hover:border-gray-9',
          `${focus}:border-${scale}-${STEP.solid} ${focus}:outline-none`,
          `${focus}:ring-[3px] ${focus}:ring-${scale}-${STEP.focusRing}`,
        ],
        invalid: `border-${DANGER}-${STEP.solid} ring-[3px] ring-${DANGER}-${STEP.focusRing} ${focus}:outline-none`,
      }),
    },
    // Height and radius only — deliberately not padding or font-size.
    // A stepper, a tag list and a plain input want different insets at the same
    // height, and their font sizes genuinely differ today (Input is 14px, the
    // comboboxes are text-ui at 13px) with nothing in the spec saying they
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

export type FieldSize = 'sm' | 'md' | 'lg';
