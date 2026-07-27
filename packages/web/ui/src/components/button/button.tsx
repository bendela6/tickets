import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { HUE_TONES, STEP, TONE_SCALE, variants, type Tone } from '../../style';
import { Spinner } from '../spinner';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  /** Which ramp the variant paints from. Defaults per variant — `destructive`
   *  is `danger`, everything else `primary` — so the four variants keep the
   *  colors they had before this prop existed. */
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

// Per-variant fill/text/border + hover + focus halo, matching design-system.html
// §06 Buttons. Primary gets a 1px inset app-colored ring inside the 3px accent
// halo (design: `0 0 0 3px var(--acs), 0 0 0 1px var(--bg) inset`); secondary
// swaps its border to accent on focus; destructive halos in danger-subtle.
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
      default: 'secondary',
      params: { scale: { default: 'indigo', values: HUE_TONES } },
      options: ({ scale }: { scale?: string }) => ({
        primary: [
          `bg-${scale}-${STEP.solid} text-${scale}-${STEP.contrast} border border-transparent hover:bg-${scale}-${STEP.solidHover}`,
          `focus-visible:ring-[3px] focus-visible:ring-${scale}-${STEP.focusRing}`,
          'focus-visible:shadow-[inset_0_0_0_1px_var(--color-gray-1)]',
        ],
        // Secondary is a surface button: it reads as chrome rather than as an
        // action in a color, so only its focus affordance follows the tone.
        secondary: [
          'bg-surface-raised text-gray-12 border border-gray-7 hover:bg-surface-inset hover:border-gray-9',
          `focus-visible:ring-[3px] focus-visible:ring-${scale}-${STEP.focusRing} focus-visible:border-${scale}-${STEP.solid}`,
        ],
        ghost: [
          'bg-transparent text-gray-11 border border-transparent hover:bg-surface-inset hover:text-gray-12',
          `focus-visible:ring-[3px] focus-visible:ring-${scale}-${STEP.focusRing}`,
        ],
        destructive: [
          `bg-${scale}-${STEP.solid} text-${scale}-${STEP.contrast} border border-transparent hover:bg-${scale}-${STEP.solidHover}`,
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

// Design's DISABLED row swaps colors per variant (opacity only where the design
// uses it) rather than a blanket dim; appended after the variant classes so
// tailwind-merge evicts the base fill/text/border. Applied only when the button
// is genuinely disabled — a loading button is also `disabled` but must keep its
// full variant fill (design LOADING row), so these are gated on !loading.
//
// Kept as its own `variants` call rather than a fifth axis on `buttonClass`
// because it is not something a caller selects — it is a state the component
// derives from `disabled && !loading`. Being a `variants` call is what puts its
// tone-dependent classes in front of the enumeration.
const disabledClass = variants({
  base: '',
  config: {
    variant: {
      default: 'secondary',
      params: { scale: { default: 'red', values: HUE_TONES } },
      options: ({ scale }: { scale?: string }) => ({
        primary: 'bg-surface-inset text-gray-9',
        secondary: 'bg-gray-1 text-gray-9 border-gray-6',
        ghost: 'text-gray-9 opacity-60',
        destructive: `bg-${scale}-${STEP.bgSubtle} text-${scale}-${STEP.solid} dark:text-${scale}-${STEP.solid} opacity-[0.55]`,
      }),
    },
  },
});

const DEFAULT_TONE: Record<NonNullable<ButtonProps['variant']>, Tone> = {
  primary: 'primary',
  secondary: 'primary',
  ghost: 'primary',
  destructive: 'danger',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    tone,
    size = 'md',
    loading = false,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const showDisabled = Boolean(disabled) && !loading;
  const scale = TONE_SCALE[tone ?? DEFAULT_TONE[variant]];
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({
        variant,
        scale,
        size,
        className: showDisabled
          ? disabledClass({ variant, scale, className })
          : className,
      })}
      {...rest}
    >
      {loading ? <Spinner size={12} /> : null}
      {children}
    </button>
  );
});
