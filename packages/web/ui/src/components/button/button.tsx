import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../style/cn';
import { Spinner } from '../spinner';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'compact' | 'regular' | 'touch' | 'icon';
  loading?: boolean;
};

// Per-variant fill/text/border + hover + focus halo, matching design-system.html
// §06 Buttons. Primary gets a 1px inset app-colored ring inside the 3px accent
// halo (design: `0 0 0 3px var(--acs), 0 0 0 1px var(--bg) inset`); secondary
// swaps its border to accent on focus; destructive halos in danger-subtle.
const variantClasses = {
  primary:
    'bg-indigo-9 text-indigo-contrast border border-transparent hover:bg-indigo-10 ' +
    'focus-visible:ring-[3px] focus-visible:ring-indigo-3 ' +
    'focus-visible:shadow-[inset_0_0_0_1px_var(--color-gray-1)]',
  secondary:
    'bg-surface-raised text-gray-12 border border-gray-7 hover:bg-surface-inset hover:border-gray-9 ' +
    'focus-visible:ring-[3px] focus-visible:ring-indigo-3 focus-visible:border-indigo-9',
  ghost:
    'bg-transparent text-gray-11 border border-transparent hover:bg-surface-inset hover:text-gray-12 ' +
    'focus-visible:ring-[3px] focus-visible:ring-indigo-3',
  destructive:
    'bg-red-9 text-red-contrast border border-transparent hover:bg-red-10 ' +
    'focus-visible:ring-[3px] focus-visible:ring-red-3',
};

// Design's DISABLED row swaps colors per variant (opacity only where the design
// uses it) rather than a blanket dim; appended after variantClasses so
// tailwind-merge evicts the base fill/text/border. Applied only when the button
// is genuinely disabled — a loading button is also `disabled` but must keep its
// full variant fill (design LOADING row), so these are gated on !loading.
const disabledClasses = {
  primary: 'bg-surface-inset text-gray-9',
  secondary: 'bg-gray-1 text-gray-9 border-gray-6',
  ghost: 'text-gray-9 opacity-60',
  destructive: 'bg-red-3 text-red-9 dark:text-red-9 opacity-[0.55]',
};

// NOTE: font-size utilities here use arbitrary lengths (text-[12px]/text-[13px])
// rather than the semantic `text-ui`/`text-meta` tokens on purpose. tailwind-merge
// does not know those custom named sizes are font-sizes, so it groups them with
// `text-{color}` utilities and silently drops the color (e.g. text-indigo-contrast).
// Arbitrary lengths are classified as font-size, so the variant color survives.
// Radius is per-size (design: 6 / 8 / 10 / 8 px), not the 5px `rounded-md`.
const sizeClasses = {
  compact: 'h-7 px-2.5 rounded-[6px] text-[12px]',
  regular: 'h-9 px-3.5 rounded-[8px] text-[13px]',
  touch: 'h-11 px-[18px] rounded-[10px] text-[14px]',
  icon: 'h-8 w-8 p-0 rounded-[8px] text-[15px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'regular',
    loading = false,
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
      className={cn(
        'inline-flex items-center justify-center gap-2 font-sans font-medium',
        'transition-colors select-none active:translate-y-px',
        'focus-visible:outline-none',
        'disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        showDisabled && disabledClasses[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={12} /> : null}
      {children}
    </button>
  );
});
