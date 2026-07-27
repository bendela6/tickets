import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@tickets/ui';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: 'compact' | 'regular';
  invalid?: boolean;
};

export const inputClasses = (invalid: boolean | undefined, className?: string) =>
  cn(
    'w-full appearance-none rounded-[8px] border bg-surface-raised font-sans text-[14px] text-gray-12 placeholder:text-gray-9',
    'transition-colors focus:outline-none focus:ring-[3px]',
    invalid
      ? 'border-red-9 ring-[3px] ring-red-3'
      : 'border-gray-7 hover:border-gray-9 focus:border-indigo-9 focus:ring-indigo-3',
    'disabled:border-gray-6 disabled:bg-surface-inset disabled:text-gray-9',
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
