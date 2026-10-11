import type { LabelHTMLAttributes } from 'react';
import { cn } from '../../../../style/cn';

type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  /** Adds a red asterisk after the label. */
  required?: boolean;
};

/** A field's caption: a `<label>` in uppercase, with a mark when the field is required. */
export function FieldLabel({ required, className, children, ...rest }: FieldLabelProps) {
  return (
    <label
      className={cn(
        'text-11/13 font-500 text-gray-11 block font-sans tracking-wider uppercase',
        className,
      )}
      {...rest}
    >
      {children}
      {required ? <span className="text-red-9"> *</span> : null}
    </label>
  );
}
