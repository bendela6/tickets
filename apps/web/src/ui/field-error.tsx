import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function FieldError({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      role="alert"
      className={cn('mt-1.25 font-sans text-meta text-danger', className)}
      {...rest}
    />
  );
}
