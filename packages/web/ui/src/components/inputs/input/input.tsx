import { forwardRef, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../../style';
import { fieldClass, fieldState } from '../field';
import { readOnlyFieldClass, type ControlProps, type ControlSize } from '../control';

/**
 * The single-line text control, on the shared control contract.
 *
 * `value`/`onChange` speak the VALUE, not the DOM event — `ControlProps<string>`
 * is the whole point: a caller holding a string can drive this, a Textarea or a
 * Combobox without knowing which it holds. The event is unwrapped here, once,
 * instead of at every one of the call sites.
 *
 * Everything else an `<input>` understands still passes through, minus the
 * three names the contract takes over.
 */
// Not exported, matching Textarea and NumberInput — and `@tickets/form` already
// exports an unrelated `InputProps` that this package's barrel re-exports past.
type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'size'
> &
  ControlProps<string> & {
    /** Content pinned inside the field, before the text — an icon, a currency mark. */
    leading?: ReactNode;
    /** Content pinned inside the field, after the text — a unit, a shortcut hint,
     *  a clear button. */
    trailing?: ReactNode;
  };

// Padding and font-size are per-component, not part of `fieldClass` — see the
// note there. These values are Input's existing ones, with lg extrapolated.
const BOX: Record<ControlSize, string> = {
  xs: 'px-9 text-13',
  md: 'px-12 text-14',
  lg: 'px-14 text-15' };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { value, onChange, size = 'md', tone, disabled, readOnly, leading, trailing, className, ...rest },
  ref,
) {
  const field = fieldState(tone);
  const invalid = field.invalid || undefined;

  // The half of the contract that lands on the <input> itself, identical down
  // both render paths. Shared rather than written out twice so the adorned path
  // cannot drift from the bare one — the bug this component would otherwise
  // grow is a `readOnly` that works until someone adds a trailing icon.
  const control = {
    value,
    // The contract's onChange takes the value. Unwrapping the event here is the
    // only translation this component owes the DOM, and the event goes second
    // for the few call sites that read modifier keys off it.
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value, event),
    disabled,
    // An <input> is one of the elements HTML's `readonly` actually reaches
    // (unlike checkbox, radio and range), so the real attribute does the
    // behavioural half — still focusable, still submitted, no longer editable.
    readOnly,
    'aria-invalid': invalid,
  };

  // The plain field: chrome on the <input> itself, and `className` landing
  // there. `rest` is spread FIRST so nothing a caller happens to spread in can
  // beat the contract props that follow it.
  if (!leading && !trailing) {
    return (
      <input
        {...rest}
        ref={ref}
        {...control}
        className={fieldClass({
          state: field.state,
          scale: field.scale,
          size,
          // The visual half of read-only, which the attribute alone does not
          // carry: an un-restyled read-only field is indistinguishable from an
          // editable one. Composed in TS rather than through Tailwind's
          // `read-only:` variant — that variant compiles to the CSS
          // `:read-only` pseudo-class, which also matches the wrapper `div` the
          // adorned path below renders, where it would be permanently on. It
          // lands in `className`, which `variants` merges last, so it beats the
          // resting border and the toned one alike.
          className: cn('w-full', BOX[size], readOnly && readOnlyFieldClass, className) })}
      />
    );
  }

  // With an adornment the chrome moves to a wrapper and the inner input goes
  // bare, so the border draws around both. Same shape NumberInput already uses
  // for its stepper — including `focus: 'focus-within'`, since focus lands on
  // the inner input and never on the wrapper, and the same reason the read-only
  // ground is composed here: the border being restyled is this div's.
  return (
    <div
      className={fieldClass({
        state: field.state,
        scale: field.scale,
        size,
        focus: 'focus-within',
        className: cn(
          'flex w-full items-center gap-8',
          BOX[size],
          // `fieldClass` says `disabled:*`, and those variants only fire on the
          // element that carries the attribute — which on this path is the
          // inner input, never this wrapper. So an adorned disabled field kept
          // the raised ground and full-contrast text while the bare one dimmed:
          // the same prop, two different looks. Stated here instead, the way
          // NumberInput already does for its stepper.
          disabled && 'border-gray-6 bg-surface-inset text-gray-9',
          readOnly && readOnlyFieldClass,
          className) })}
    >
      {leading}
      <input
        {...rest}
        ref={ref}
        {...control}
        className="min-w-0 flex-1 bg-transparent p-0 font-sans text-gray-12 outline-none placeholder:text-gray-9"
      />
      {trailing}
    </div>
  );
});
