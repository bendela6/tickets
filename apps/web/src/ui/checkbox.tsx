import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  indeterminate?: boolean;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate = false, className, ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (inner.current) {
      inner.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  return (
    <label
      className={cn(
        'group inline-flex cursor-pointer items-center gap-2 font-sans text-ui text-ink has-disabled:cursor-not-allowed',
        className,
      )}
    >
      <span className="relative inline-flex size-4 shrink-0">
        <input
          ref={(node) => {
            inner.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          type="checkbox"
          className={cn(
            // shrink-0 is required: as a flex item the input otherwise collapses
            // from 16px to ~9px wide (the switch/radio inputs already have it).
            'peer m-0 size-4 shrink-0 appearance-none rounded-[4px] border-[1.5px] border-control bg-raised transition-colors',
            'checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent',
            'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle',
            'disabled:cursor-not-allowed disabled:border-hairline disabled:bg-inset',
          )}
          {...rest}
        />
        {/* Checkmark / dash rendered as overlays (not bg-image) so they never
            conflict with checked:bg-accent under tailwind-merge. */}
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden size-4 p-px text-on-accent peer-checked:block"
        >
          <path
            d="M2.5 6.5 5 9l4.5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden size-4 p-px text-on-accent peer-indeterminate:block"
        >
          <path
            d="M3 6h6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="group-has-disabled:text-ink-3">{label}</span>
    </label>
  );
});
