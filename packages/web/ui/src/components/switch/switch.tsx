import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../style/cn';

type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string };

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, className, ...rest },
  ref,
) {
  return (
    <label
      className={cn(
        'group inline-flex cursor-pointer items-center gap-2 font-sans text-ui text-gray-12 has-disabled:cursor-not-allowed',
        className,
      )}
    >
      <span className="relative inline-flex">
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          className={cn(
            // 32×18 track: solid bg-gray-7 when off, bg-indigo-9 when on, no border
            // (a 1px hairline border appears only when disabled, over bg-surface-inset).
            'peer m-0 h-4.5 w-8 shrink-0 appearance-none rounded-full border-0 bg-gray-7 transition-colors',
            'checked:bg-indigo-9',
            'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-indigo-3',
            'disabled:cursor-not-allowed disabled:border disabled:border-gray-6 disabled:bg-surface-inset',
          )}
          {...rest}
        />
        <span
          aria-hidden
          className={cn(
            // 14px thumb, inset 2px. Off thumb: white (light) / app (dark).
            // On thumb: white (light) / on-accent (dark). Disabled thumb: hairline.
            'pointer-events-none absolute left-0.5 top-0.5 size-3.5 rounded-full transition-transform',
            'bg-white dark:bg-gray-1 dark:peer-checked:bg-indigo-contrast peer-disabled:bg-gray-6',
            'peer-checked:translate-x-3.5',
          )}
        />
      </span>
      <span className="group-has-disabled:text-gray-9">{label}</span>
    </label>
  );
});
