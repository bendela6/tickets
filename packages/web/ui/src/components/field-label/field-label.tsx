import type { LabelHTMLAttributes } from 'react';
import { cn } from '../../style/cn';

type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean };

export function FieldLabel({ required, className, children, ...rest }: FieldLabelProps) {
  return (
    <label
      className={cn('block font-sans text-label font-500 uppercase text-gray-11', className)}
      {...rest}
    >
      {children}
      {required ? <span className="text-red-9"> *</span> : null}
    </label>
  );
}
