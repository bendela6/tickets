import type { HTMLAttributes } from 'react';
import { cn } from '../../style/cn';

export function FieldError({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      role="alert"
      className={cn('mt-1.25 font-sans text-12/17 text-red-9', className)}
      {...rest}
    />
  );
}
