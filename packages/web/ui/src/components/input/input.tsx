import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn, TONE_SCALE, type Tone } from '../../style';
import { fieldClass, type FieldSize } from '../field';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: FieldSize;
  /** Which ramp the focus ring paints from. Defaults to `primary`. */
  tone?: Tone;
  invalid?: boolean;
};

// Horizontal padding is per-size and stays here rather than in `fieldClass`:
// a stepper and a tag list want different insets at the same height.
const PADDING: Record<FieldSize, string> = {
  sm: 'px-2.25',
  md: 'px-3',
  lg: 'px-3.5',
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
        className: cn('w-full', PADDING[size], className),
      })}
      {...rest}
    />
  );
});
