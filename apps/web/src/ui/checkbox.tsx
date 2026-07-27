import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from 'react';
import { cn } from '@tickets/ui';

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
            conflict with checked:bg-accent under tailwind-merge.
            Kept as hand-rolled inline SVGs rather than <Icon name="check"/> /
            <Icon name="minus"/> (task-12 sweep, step 4): the registry's
            "check"/"minus" glyphs are drawn on a 16-unit viewBox sized for a
            standalone 14-16px icon, while these are purpose-fit to this
            control's exact 12-unit viewBox + 1.5px stroke + size-4 p-px
            overlay geometry (peer-checked/peer-indeterminate toggled, full
            bleed over the input). Swapping in the registry glyphs would shift
            the mark's proportions inside the box in a way that can't be
            verified without a browser pass (out of scope for this task), so
            the original geometry stays. checkbox.tsx is the one file this
            sweep's `grep -rln "<svg" apps/web/src` allows to remain. */}
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
