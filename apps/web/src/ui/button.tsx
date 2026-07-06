import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'compact' | 'regular' | 'touch' | 'icon';
  loading?: boolean;
};

const variantClasses = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover border border-transparent',
  secondary: 'bg-raised text-ink border border-control hover:bg-inset',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-inset hover:text-ink',
  destructive: 'bg-transparent text-danger border border-control hover:bg-danger-subtle',
};

const sizeClasses = {
  compact: 'h-7 px-2.5 text-ui',
  regular: 'h-9 px-3.5 text-ui',
  touch: 'h-11 px-4 text-sm',
  icon: 'h-8 w-8 p-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'regular', loading = false, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-ctrl font-sans font-medium',
        'transition-colors select-none active:translate-y-px',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle focus-visible:border-accent',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
});
