import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string };

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, className, ...rest },
  ref,
) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 font-sans text-ui text-ink', className)}>
      <span className="relative inline-flex">
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          className={cn(
            'peer m-0 h-5 w-9 shrink-0 appearance-none rounded-full border border-control bg-inset transition-colors',
            'checked:border-accent checked:bg-accent',
            'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          {...rest}
        />
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute left-0.5 top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform',
            'peer-checked:translate-x-4',
          )}
        />
      </span>
      <span className="peer-disabled:opacity-50">{label}</span>
    </label>
  );
});
