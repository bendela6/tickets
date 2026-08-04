import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn, type Tone } from '../../style';
import { fieldClass, fieldState, type FieldSize } from '../field';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: FieldSize;
  /** What the field is saying about itself. Unset is the resting field —
   *  gray border, accent focus ring. Any tone colours the border, and
   *  `danger` also sets aria-invalid. */
  tone?: Tone;
  /** Content pinned inside the field, before the text — an icon, a currency mark. */
  leading?: ReactNode;
  /** Content pinned inside the field, after the text — a unit, a shortcut hint,
   *  a clear button. */
  trailing?: ReactNode;
};

// Padding and font-size are per-component, not part of `fieldClass` — see the
// note there. These values are Input's existing ones, with lg extrapolated.
const BOX: Record<FieldSize, string> = {
  sm: 'px-9 text-13',
  md: 'px-12 text-14',
  lg: 'px-14 text-15',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', tone, leading, trailing, className, ...rest },
  ref,
) {
  const field = fieldState(tone);
  const invalid = field.invalid || undefined;

  // The plain field stays exactly as it was: chrome on the <input> itself, and
  // `className` landing there. Every existing call site renders unchanged.
  if (!leading && !trailing) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid}
        className={fieldClass({
          state: field.state,
          scale: field.scale,
          size,
          className: cn('w-full', BOX[size], className),
        })}
        {...rest}
      />
    );
  }

  // With an adornment the chrome moves to a wrapper and the inner input goes
  // bare, so the border draws around both. Same shape NumberInput already uses
  // for its stepper — including `focus: 'focus-within'`, since focus lands on
  // the inner input and never on the wrapper.
  return (
    <div
      className={fieldClass({
        state: field.state,
        scale: field.scale,
        size,
        focus: 'focus-within',
        className: cn('flex w-full items-center gap-8', BOX[size], className),
      })}
    >
      {leading}
      <input
        ref={ref}
        aria-invalid={invalid}
        className="min-w-0 flex-1 bg-transparent p-0 font-sans text-gray-12 outline-none placeholder:text-gray-9"
        {...rest}
      />
      {trailing}
    </div>
  );
});
