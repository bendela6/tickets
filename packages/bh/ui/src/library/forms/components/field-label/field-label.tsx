import type { LabelHTMLAttributes } from 'react';
import { cn } from '../../../../style/cn';
import { CAPTION_CLASS, RequiredMark } from './caption';

type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  /** Adds a red asterisk after the label. */
  required?: boolean;
};

/** A field's caption: a `<label>` in uppercase, with a mark when the field is required. */
export function FieldLabel({ required, className, children, ...rest }: FieldLabelProps) {
  return (
    <label className={cn(CAPTION_CLASS, className)} {...rest}>
      {children}
      {required ? <RequiredMark /> : null}
    </label>
  );
}
