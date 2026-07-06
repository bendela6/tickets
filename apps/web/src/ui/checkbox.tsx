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
    <label className={cn('inline-flex cursor-pointer items-center gap-2 font-sans text-ui text-ink', className)}>
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
          'peer size-4 shrink-0 appearance-none rounded-[4px] border border-control bg-raised transition-colors',
          'checked:border-accent checked:bg-accent indeterminate:border-accent indeterminate:bg-accent',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-subtle',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          "checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22><path d=%22M2.5 6.5l2.5 2.5 4.5-5%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222%22/></svg>')] checked:bg-center checked:bg-no-repeat",
          "indeterminate:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22><path d=%22M3 6h6%22 stroke=%22white%22 stroke-width=%222%22/></svg>')] indeterminate:bg-center indeterminate:bg-no-repeat",
        )}
        {...rest}
      />
      <span className="peer-disabled:opacity-50">{label}</span>
    </label>
  );
});
