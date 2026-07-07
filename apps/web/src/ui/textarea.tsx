import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';
import { inputClasses } from './input';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        inputClasses(invalid),
        'min-h-18 resize-y px-3 py-2.5 leading-normal',
        className,
      )}
      {...rest}
    />
  );
});
