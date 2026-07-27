import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn, type Tone } from '../../style';
import { fieldClass, fieldState, type FieldSize } from '../field';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: FieldSize;
  /** What the field is saying about itself. Unset is the resting field —
   *  gray border, accent focus ring. Any tone colours the border, and
   *  `danger` also sets aria-invalid. */
  tone?: Tone;
};

// Padding and font-size are per-component, not part of `fieldClass` — see the
// note there. These values are Input's existing ones, with lg extrapolated.
const BOX: Record<FieldSize, string> = {
  sm: 'px-2.25 text-[13px]',
  md: 'px-3 text-[14px]',
  lg: 'px-3.5 text-[15px]',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', tone, className, ...rest },
  ref,
) {
  const field = fieldState(tone);
  return (
    <input
      ref={ref}
      aria-invalid={field.invalid || undefined}
      className={fieldClass({
        state: field.state,
        scale: field.scale,
        size,
        className: cn('w-full', BOX[size], className),
      })}
      {...rest}
    />
  );
});
