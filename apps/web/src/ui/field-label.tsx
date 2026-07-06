import type { LabelHTMLAttributes } from 'react';
import { cn } from './cn';

type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean };

export function FieldLabel({ required, className, children, ...rest }: FieldLabelProps) {
  return (
    <label
      className={cn('block font-sans text-label font-medium tracking-wider uppercase text-ink-2', className)}
      {...rest}
    >
      {children}
      {required ? <span className="text-danger"> *</span> : null}
    </label>
  );
}
