import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../../../style';
import { fieldClass, fieldState } from '../../parts/field';
import {
  readOnlyFieldClass,
  type CommitProps,
  type ControlProps,
  type ControlSize,
} from '../../contract';
import { useInlineEdit } from '../../parts/inline-edit/use-inline-edit';

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
  ControlProps<string> &
  CommitProps<string>;

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

/** Several lines of text, held by the caller: `onChange` hands over the new value. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    value,
    onChange,
    size = 'md',
    tone,
    disabled,
    readOnly,
    commit = 'change',
    onDraft,
    onKeyDown,
    onBlur,
    className,
    ...rest
  },
  ref,
) {
  const field = fieldState(tone);
  // The event isn't passed on, as it never was here: `onChange` gets the value.
  const edit = useInlineEdit({
    value,
    onCommit: (next: string) => onChange(next),
    commit,
    onDraft,
  });
  return (
    <textarea
      // The caller's ref, and the draft's: it hears an Escape aimed at the
      // field before a dialog around it does.
      ref={(node) => {
        edit.ref(node);
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      value={edit.draft}
      // The contract's onChange takes the value. Unwrapping the event here is
      // the only translation this component owes the DOM.
      onChange={(e) => edit.change(e.target.value)}
      // Enter stays a new line: Ctrl/Cmd+Enter commits instead. Escape puts
      // the value back. Both before the caller's own handler sees the key.
      onKeyDown={(event) => {
        edit.onKeyDown(event, { enter: false });
        onKeyDown?.(event);
      }}
      onBlur={(event) => {
        edit.onBlur(event);
        onBlur?.(event);
      }}
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
