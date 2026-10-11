import type { HTMLAttributes } from 'react';
import { cn } from '../../../../style/cn';

/** A field's error message, in red, announced as an alert. */
export function FieldError({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p role="alert" className={cn('text-12/17 text-red-9 mt-5 font-sans', className)} {...rest} />
  );
}
