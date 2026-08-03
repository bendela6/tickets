import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { axis, HUE_TONES, over, TONE_RAMP, variants, type Tone } from '../../style';
import { Icon, type IconSize } from '../icon';
import { Spinner } from '../spinner';

// Which ramp this component paints from. `scale` is the prop it surfaces as.
const SCALE = axis('scale', HUE_TONES, 'indigo');

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
// Each option is written once and expanded over `SCALE` — the axis names the
// `scale` prop and owns its domain, so this file never restates which ramps
// exist. `tone` is the bare scale name and the rung is spelled here: 3-5 are
// component fills, 7-8 borders, 9-10 solid fills, 11-12 text, the same ladder
// on every scale (see the Colors page). None of these classes exist as literal
// text anywhere, so `bg-green-9`/`hover:bg-green-10` only reach the safelist
// because the enumeration walks the axis over all 11 ramps.
//
// Read each option down, not across: fill, text, border, focus, extra.
const buttonClass = variants({
  base: [
    'inline-flex items-center justify-center gap-2 font-sans font-500',
    'transition-colors select-none active:translate-y-px',
    'focus-visible:outline-none',
    'disabled:pointer-events-none',
  ],
  config: {
    variant: {
      default: 'outline',
      options: {
        solid: over(SCALE, (tone) => [
          `bg-${tone}-9 hover:bg-${tone}-10`,
          `text-${tone}-contrast`,
          'border-1 border-transparent',
          `focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-${tone}-3`,
          'focus-visible:shadow-[inset_0_0_0_1px_var(--color-gray-1)]',
        ]),
        subtle: over(SCALE, (tone) => [
          `bg-${tone}-3 hover:bg-${tone}-4`,
          `text-${tone}-11`,
          'border-1 border-transparent',
          `focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-${tone}-3`,
        ]),
        // Border and text follow the tone, matching what `TONES.outline`
        // resolves to for a Pill asking for the same treatment — the two must
        // not diverge on a shared variant name.
        outline: over(SCALE, (tone) => [
          `bg-surface-raised hover:bg-${tone}-3`,
          `text-${tone}-11`,
          `border-2 border-${tone}-7 hover:border-${tone}-8`,
          `focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-${tone}-3 focus-visible:border-${tone}-9`,
        ]),
        // Ghost is Button's answer to Pill's `text` emphasis — the same tone
        // text, plus the hover surface a button needs and a tag does not.
        ghost: over(SCALE, (tone) => [
          `bg-transparent hover:bg-${tone}-4`,
          `text-${tone}-11 hover:text-${tone}-12`,
          'border-1 border-transparent',
          `focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-${tone}-3`,
        ]),
      },
    },
    // NOTE: font-size utilities here use arbitrary lengths (text-12/text-13)
    // rather than the semantic `text-13/19`/`text-12/17` tokens on purpose. tailwind-merge
    // does not know those custom named sizes are font-sizes, so it groups them with
    // `text-{color}` utilities and silently drops the color (e.g. text-indigo-contrast).
    // Arbitrary lengths are classified as font-size, so the variant color survives.
    // Radius is per-size: the design's 6 / 8 / 10 px, snapped to the scale's
    // md / lg / xl. Only `lg` moves — 10px was never a rung.
    size: {
      default: 'md',
      options: {
        sm: 'h-7 px-2.5 rounded-md text-12',
        md: 'h-9 px-3.5 rounded-lg text-13',
        lg: 'h-11 px-[18px] rounded-xl text-14',
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
        scale: TONE_RAMP[tone],
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
