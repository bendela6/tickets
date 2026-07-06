import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: 'compact' | 'regular';
  invalid?: boolean;
};

export const inputClasses = (invalid: boolean | undefined, className?: string) =>
  cn(
    'w-full appearance-none rounded-[8px] border bg-raised font-sans text-[14px] text-ink placeholder:text-ink-3',
    'transition-colors focus:outline-none focus:ring-[3px]',
    invalid
      ? 'border-danger ring-[3px] ring-danger-subtle'
      : 'border-control hover:border-ink-3 focus:border-accent focus:ring-accent-subtle',
    'disabled:border-hairline disabled:bg-inset disabled:text-ink-3',
    className,
  );

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'regular', invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        inputClasses(invalid),
        size === 'compact' ? 'h-7 rounded-[6px] px-2.25 text-[13px]' : 'h-9 px-3',
        className,
      )}
      {...rest}
    />
  );
});
