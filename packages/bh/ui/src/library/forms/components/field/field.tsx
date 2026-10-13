import { useId, type ReactNode } from 'react';
import { cn } from '../../../../style/cn';
import { FieldLabel } from '../field-label';
import { CAPTION_CLASS, RequiredMark } from '../field-label/caption';
import { FieldMessage } from './field-message';

interface FieldProps {
  /**
   * The control's id: the label becomes its `<label>`. Left out, the label
   * names a group of controls instead.
   *
   * With an id, the hint's id is `<id>-hint` and the error's `<id>-error`, so
   * the control can point `aria-describedby` at them without asking.
   */
  id?: string;
  /** The field's caption, in uppercase above the control. */
  label: ReactNode;
  /** A line under the control: what goes in it, or what it does. */
  hint?: ReactNode;
  /** What is wrong with the value. Shown in the hint's place, in red, announced as an alert. */
  error?: ReactNode;
  /** Adds a red asterisk after the label. */
  required?: boolean;
  /** Added to the field's classes: a width of its own, from the form. */
  className?: string;
  /** The control, or the controls of a group. */
  children: ReactNode;
}

/**
 * A field laid out by hand: its label, its control, then a hint or an error,
 * stacked.
 *
 * FieldWrapper is the other field, the one `@bh/form` draws: its label moves
 * beside the control in a wide form and its props are the engine's. This one
 * always stacks, takes any node as its hint, and can name a group.
 */
export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  const uid = useId();
  const base = id ?? uid;
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;
  const column = cn('flex min-w-0 flex-col gap-4', className);
  const message = <FieldMessage hint={hint} error={error} hintId={hintId} errorId={errorId} />;

  if (id !== undefined) {
    return (
      <div className={column}>
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
        {children}
        {message}
      </div>
    );
  }

  // A `<label>` names one control, so a group takes its name the way a
  // fieldset takes its legend's: the group points at the caption, and at the
  // line under it for its description. A `<div role="group">` rather than a
  // fieldset, since a fieldset's legend is drawn into its border and won't sit
  // in a column like the caption above any other field.
  const captionId = `${uid}-label`;
  const described = error ? errorId : hint ? hintId : undefined;
  return (
    <div role="group" aria-labelledby={captionId} aria-describedby={described} className={column}>
      <span id={captionId} className={CAPTION_CLASS}>
        {label}
        {required ? <RequiredMark /> : null}
      </span>
      {children}
      {message}
    </div>
  );
}
