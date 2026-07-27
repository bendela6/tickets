import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn, TONE_SCALE, type Tone } from '../../style';
import { fieldClass, type FieldSize } from '../field';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: FieldSize;
  /** Which ramp the focus ring paints from. Defaults to `primary`. */
  tone?: Tone;
  invalid?: boolean;
};

// Padding and font-size are per-component, not part of `fieldClass` — see the
// note there. These values are Input's existing ones, with lg extrapolated.
const BOX: Record<FieldSize, string> = {
  sm: 'px-2.25 text-[13px]',
  md: 'px-3 text-[14px]',
  lg: 'px-3.5 text-[15px]',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', tone = 'primary', invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={fieldClass({
        state: invalid ? 'invalid' : 'idle',
        scale: TONE_SCALE[tone],
        size,
        className: cn('w-full', BOX[size], className),
      })}
      {...rest}
    />
  );
});
