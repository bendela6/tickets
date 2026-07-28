import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn, type Tone } from '../../style';
import { fieldClass, fieldState, type FieldSize } from '../field';

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> & {
  size?: FieldSize;
  /** What the field is saying about itself. Unset is the resting field;
   *  any tone colours the border, and `danger` also sets aria-invalid. */
  tone?: Tone;
};

// A textarea grows, so its size axis sets a floor rather than a height —
// roughly two, three and four lines of body text. `fieldClass` contributes an
// `h-*` for the single-line controls, so each rung evicts it with `h-auto`
// before setting its own `min-h-*`.
const BOX: Record<FieldSize, string> = {
  sm: 'h-auto min-h-14 px-2.25 py-2 text-13',
  md: 'h-auto min-h-18 px-3 py-2.5 text-14',
  lg: 'h-auto min-h-22 px-3.5 py-3 text-15',
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { size = 'md', tone, className, ...rest },
  ref,
) {
  const field = fieldState(tone);
  return (
    <textarea
      ref={ref}
      aria-invalid={field.invalid || undefined}
      className={fieldClass({
        state: field.state,
        scale: field.scale,
        size,
        className: cn('w-full resize-y leading-normal', BOX[size], className),
      })}
      {...rest}
    />
  );
});
