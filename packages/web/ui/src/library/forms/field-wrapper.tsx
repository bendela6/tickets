import type { FieldWrapperProps } from '@tickets/form';
import { FieldError } from '../field-error';
import { FieldLabel } from '../field-label';

/**
 * The registry's `field` slot: caption, control, then either the description
 * or the error.
 *
 * **Label placement is decided by the container, not by a prop** (design file
 * 20). At or above 520px of the form's own width the label sits beside the
 * field in a 104px column; below it, the label goes on top. That is a
 * container query rather than a media query on purpose — the same form appears
 * in a 400px drawer and on a full page, and what governs is the box it is in,
 * not the size of the window. A viewport rule would put labels beside fields
 * in a narrow drawer on a wide monitor, which is the exact case the design
 * calls out.
 *
 * **The field establishes its own container**, rather than reading one from the
 * form root. Two reasons, and the second was found by measuring:
 *
 * 1. It is more correct. The design's threshold is about the room *this field*
 *    has — "a 104px label column plus a usable field needs that much" — so a
 *    field squeezed into one half of a two-column row genuinely should stack
 *    its label, and a rule measured on the form as a whole would not.
 * 2. `root` is OPTIONAL in the form registry. A consumer that omits it would
 *    have lost every label rule with no error and no visible cause — the
 *    gallery's own demo omits it, which is how this was caught.
 *
 * A container cannot be queried by the element that establishes it, hence the
 * outer div. That is the whole reason for the extra wrapper.
 */
export function FieldWrapper({
  name,
  label,
  description,
  required,
  error,
  children,
}: FieldWrapperProps) {
  const help =
    description && !error ? (
      <p className="font-sans text-12/17 text-gray-11">{description}</p>
    ) : null;

  // Shown as soon as the engine reports one. There is deliberately no `touched`
  // gate: in this stack `isTouched` flips only via setFieldValue, so a field the
  // user never edited — the case a gate is for — would keep its message
  // permanently invisible, including after a failed submit.
  const message = error ? <FieldError>{error}</FieldError> : null;

  return (
    <div className="@container">
      <div className="flex flex-col gap-4 @form-labels:flex-row @form-labels:gap-12">
        {label ? (
          // `pt-9` on the left form only: it optically centres a 12px label
          // against the 38px md control beside it. Stacked, the label sits on
          // the baseline above and needs no offset.
          <div className="@form-labels:w-104 @form-labels:shrink-0 @form-labels:pt-9">
            <FieldLabel htmlFor={name} required={required}>
              {label}
            </FieldLabel>
          </div>
        ) : (
          // Keeps the control aligned with its labelled siblings in the left
          // form. Without it, an unlabelled field starts 104px to the left of
          // every other control in the column.
          <div className="hidden @form-labels:block @form-labels:w-104 @form-labels:shrink-0" />
        )}
        <div className="flex min-w-0 flex-col gap-4 @form-labels:flex-1">
          {children}
          {help}
          {message}
        </div>
      </div>
    </div>
  );
}
