import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string };

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, className, ...rest },
  ref,
) {
  return (
    <label className={cn('group inline-flex cursor-pointer items-center gap-2 font-sans text-ui text-ink has-disabled:cursor-not-allowed', className)}>
      <span className="relative inline-flex">
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          className={cn(
            // 32×18 track: solid bg-control when off, bg-accent when on, no border
            // (a 1px hairline border appears only when disabled, over bg-inset).
            'peer m-0 h-4.5 w-8 shrink-0 appearance-none rounded-full border-0 bg-control transition-colors',
            'checked:bg-accent',
            'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle',
            'disabled:cursor-not-allowed disabled:border disabled:border-hairline disabled:bg-inset',
          )}
          {...rest}
        />
        <span
          aria-hidden
          className={cn(
            // 14px thumb, inset 2px. Off thumb: #fff (light) / app (dark).
            // On thumb: #fff (light) / on-accent (dark). Disabled thumb: hairline.
            'pointer-events-none absolute left-0.5 top-0.5 size-3.5 rounded-full transition-transform',
            'bg-white dark:bg-app dark:peer-checked:bg-on-accent peer-disabled:bg-hairline',
            'peer-checked:translate-x-3.5',
          )}
        />
      </span>
      <span className="group-has-disabled:text-ink-3">{label}</span>
    </label>
  );
});
