import type { ReactNode } from 'react';
import { FieldError } from '../field-error';

/**
 * Under a field's control: its error when it has one, its hint otherwise.
 *
 * FieldWrapper draws its description through this and Field its hint, so the
 * two kinds of field say the same things the same way. Not exported: it is
 * how they are built, not a part an app lays out.
 */
export function FieldMessage({
  hint,
  error,
  hintId,
  errorId,
}: {
  hint?: ReactNode;
  error?: ReactNode;
  hintId?: string;
  errorId?: string;
}) {
  if (error) {
    return <FieldError id={errorId}>{error}</FieldError>;
  }
  if (hint) {
    return (
      <p id={hintId} className="text-12/17 text-gray-11 font-sans">
        {hint}
      </p>
    );
  }
  return null;
}
