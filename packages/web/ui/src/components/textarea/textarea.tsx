import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn, TONE_SCALE, type Tone } from '../../style';
import { fieldClass, type FieldSize } from '../field';

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> & {
  size?: FieldSize;
  /** Which ramp the focus ring paints from. Defaults to `primary`. */
  tone?: Tone;
  invalid?: boolean;
};

// A textarea grows, so its size axis sets a floor rather than a height —
// roughly two, three and four lines of body text. `fieldClass` contributes an
// `h-*` for the single-line controls, so each rung evicts it with `h-auto`
// before setting its own `min-h-*`.
const BOX: Record<FieldSize, string> = {
  sm: 'h-auto min-h-14 px-2.25 py-2',
  md: 'h-auto min-h-18 px-3 py-2.5',
  lg: 'h-auto min-h-22 px-3.5 py-3',
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { size = 'md', tone = 'primary', invalid, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={fieldClass({
        state: invalid ? 'invalid' : 'idle',
        scale: TONE_SCALE[tone],
        size,
        className: cn('w-full resize-y leading-normal', BOX[size], className),
      })}
      {...rest}
    />
  );
});
