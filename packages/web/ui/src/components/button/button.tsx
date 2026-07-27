import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { HUE_TONES, STEP, TONE_SCALE, variants, type Tone } from '../../style';
import { Icon, type IconSize } from '../icon';
import { Spinner } from '../spinner';

/**
 * How much of the tone the button spends. Shares three of its four names with
 * Pill so `variant="solid"` means the same thing library-wide. Pill's fourth is
 * `text`; a button's is `ghost`, because ours takes a hover surface and a text
 * button does not — same word for different treatments would be worse than two
 * words for two treatments.
 */
export type ButtonVariant = 'subtle' | 'solid' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Which ramp the variant paints from. Defaults to `primary`. */
  tone?: Tone;
  size?: ButtonSize;
  loading?: boolean;
  /** Adds a trailing chevron, for a button that opens a menu or a popover. */
  chevron?: boolean;
};

// Per-variant fill/text/border + hover + focus halo, matching design-system.html
// §06 Buttons. Solid gets a 1px inset app-colored ring inside the 3px accent
// halo (design: `0 0 0 3px var(--acs), 0 0 0 1px var(--bg) inset`); outline
// swaps its border to accent on focus.
//
// The `scale` param is the *ramp* name, not the tone name — `primary` paints
// from `indigo`, so passing a tone straight through would build `bg-primary-9`,
// which no theme variable backs. Its domain is every ramp, which is what
// expands the safelist: none of these classes exist as literal text anywhere,
// so `bg-green-9`/`hover:bg-green-10` only get emitted because the enumeration
// walked this options function over all 11 ramps.
const buttonClass = variants({
  base: [
    'inline-flex items-center justify-center gap-2 font-sans font-medium',
    'transition-colors select-none active:translate-y-px',
    'focus-visible:outline-none',
    'disabled:pointer-events-none',
  ],
  config: {
    variant: {
      default: 'outline',
      params: { scale: { default: TONE_SCALE.primary, values: HUE_TONES } },
      options: ({ scale }: { scale?: string }) => ({
        solid: [
          `bg-${scale}-${STEP.solid} text-${scale}-${STEP.contrast} border border-transparent hover:bg-${scale}-${STEP.solidHover}`,
          `focus-visible:ring-[3px] focus-visible:ring-${scale}-${STEP.focusRing}`,
          'focus-visible:shadow-[inset_0_0_0_1px_var(--color-gray-1)]',
        ],
        subtle: [
          `bg-${scale}-${STEP.bgSubtle} text-${scale}-${STEP.text} border border-transparent hover:bg-${scale}-${STEP.bgSubtleHover}`,
          `focus-visible:ring-[3px] focus-visible:ring-${scale}-${STEP.focusRing}`,
        ],
        // Outline is a surface button: it reads as chrome rather than as an
        // action in a colour, so only its focus affordance follows the tone.
        outline: [
          'bg-surface-raised text-gray-12 border border-gray-7 hover:bg-surface-inset hover:border-gray-9',
          `focus-visible:ring-[3px] focus-visible:ring-${scale}-${STEP.focusRing} focus-visible:border-${scale}-${STEP.solid}`,
        ],
        ghost: [
          'bg-transparent text-gray-11 border border-transparent hover:bg-surface-inset hover:text-gray-12',
          `focus-visible:ring-[3px] focus-visible:ring-${scale}-${STEP.focusRing}`,
        ],
      }),
    },
    // NOTE: font-size utilities here use arbitrary lengths (text-[12px]/text-[13px])
    // rather than the semantic `text-ui`/`text-meta` tokens on purpose. tailwind-merge
    // does not know those custom named sizes are font-sizes, so it groups them with
    // `text-{color}` utilities and silently drops the color (e.g. text-indigo-contrast).
    // Arbitrary lengths are classified as font-size, so the variant color survives.
    // Radius is per-size (design: 6 / 8 / 10 px), not the 5px `rounded-md`.
    size: {
      default: 'md',
      options: {
        sm: 'h-7 px-2.5 rounded-[6px] text-[12px]',
        md: 'h-9 px-3.5 rounded-[8px] text-[13px]',
        lg: 'h-11 px-[18px] rounded-[10px] text-[14px]',
      },
    },
  },
});

// Design's DISABLED row swaps colours per variant rather than a blanket dim;
// appended after the variant classes so tailwind-merge evicts the base
// fill/text/border. Applied only when the button is genuinely disabled — a
// loading button is also `disabled` but must keep its full variant fill
// (design LOADING row), so these are gated on !loading.
//
// These are deliberately tone-independent: a disabled control is out of play,
// and tinting it with its tone would keep drawing attention to a thing that
// cannot be used.
const DISABLED: Record<ButtonVariant, string> = {
  solid: 'bg-surface-inset text-gray-9',
  subtle: 'bg-surface-inset text-gray-9',
  outline: 'bg-gray-1 text-gray-9 border-gray-6',
  ghost: 'text-gray-9 opacity-60',
};

const CHEVRON: Record<ButtonSize, IconSize> = { sm: 'sm', md: 'sm', lg: 'md' };
const SPINNER: Record<ButtonSize, IconSize> = { sm: 'sm', md: 'sm', lg: 'md' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'outline',
    tone = 'primary',
    size = 'md',
    loading = false,
    chevron = false,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const showDisabled = Boolean(disabled) && !loading;
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({
        variant,
        scale: TONE_SCALE[tone],
        size,
        className: showDisabled ? `${DISABLED[variant]} ${className ?? ''}`.trim() : className,
      })}
      {...rest}
    >
      {loading ? <Spinner size={SPINNER[size]} /> : null}
      {children}
      {chevron ? <Icon name="chevron-down" size={CHEVRON[size]} className="-mr-0.5" /> : null}
    </button>
  );
});
