import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../../../style';
import { fieldClass, fieldState } from '../../parts/field';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../../contract';

/**
 * The multi-line text control, on the shared control contract.
 *
 * `value`/`onChange` speak the VALUE, not the DOM event — `ControlProps<string>`
 * is the whole point: a caller holding a string can drive this, an Input or a
 * Combobox without knowing which it holds. The event is unwrapped here, once,
 * instead of at every call site.
 *
 * Everything else a `<textarea>` understands still passes through, minus the
 * three names the contract takes over.
 */
type TextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange' | 'size'
> &
  ControlProps<string>;

// A textarea grows, so its size axis sets a FLOOR rather than a height —
// roughly two, three and four lines of body text. This is the one thing the
// shared ladder cannot supply: `fieldClass` contributes a fixed `h-*` for the
// single-line controls, so each rung has to evict it with `h-auto` before
// setting its own `min-h-*`. Horizontal padding and font size are NOT repeated
// here — they come from `CONTROL_LADDER`, and restating them would win the
// twMerge and silently pin the old ladder.
const BOX: Record<ControlSize, string> = {
  xs: 'h-auto min-h-56 py-8',
  md: 'h-auto min-h-72 py-10',
  lg: 'h-auto min-h-88 py-12',
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { value, onChange, size = 'md', tone, disabled, readOnly, className, ...rest },
  ref,
) {
  const field = fieldState(tone);
  return (
    <textarea
      ref={ref}
      value={value}
      // The contract's onChange takes the value. Unwrapping the event here is
      // the only translation this component owes the DOM.
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      // A <textarea> is one of the elements HTML's `readonly` actually reaches
      // (unlike checkbox, radio and range), so the real attribute does the
      // behavioural half — still focusable, still submitted, no longer editable.
      readOnly={readOnly}
      aria-invalid={field.invalid || undefined}
      className={fieldClass({
        state: field.state,
        scale: field.scale,
        size,
        // ...and the class does the visual half, which the attribute alone does
        // not carry: an un-restyled read-only field is indistinguishable from an
        // editable one. Composed in TS rather than through Tailwind's
        // `read-only:` variant — see `readOnlyFieldClass` for why that variant is
        // the wrong tool. It lands in `className`, which `variants` merges last,
        // so it beats the resting border and the toned one alike.
        className: cn(
          'w-full leading-normal',
          // A locked field keeps no resize grip. The handle is an affordance
          // that promises an edit, and dragging it on a disabled or read-only
          // box changes the one thing you are still allowed to change — which
          // reads as the control half-working rather than as locked.
          disabled || readOnly ? 'resize-none' : 'resize-y',
          BOX[size],
          readOnly && readOnlyFieldClass,
          className,
        ),
      })}
      {...rest}
    />
  );
});
