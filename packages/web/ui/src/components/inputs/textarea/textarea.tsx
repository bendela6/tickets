import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../../style';
import { fieldClass, fieldState } from '../field';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../control';

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

// A textarea grows, so its size axis sets a floor rather than a height —
// roughly two, three and four lines of body text. `fieldClass` contributes an
// `h-*` for the single-line controls, so each rung evicts it with `h-auto`
// before setting its own `min-h-*`.
const BOX: Record<ControlSize, string> = {
  sm: 'h-auto min-h-56 px-9 py-8 text-13',
  md: 'h-auto min-h-72 px-12 py-10 text-14',
  lg: 'h-auto min-h-88 px-14 py-12 text-15',
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
          'w-full resize-y leading-normal',
          BOX[size],
          readOnly && readOnlyFieldClass,
          className,
        ),
      })}
      {...rest}
    />
  );
});
