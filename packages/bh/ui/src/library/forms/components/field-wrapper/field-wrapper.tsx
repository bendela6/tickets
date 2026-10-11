import type { FieldWrapperProps } from '@bh/form';
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
 *    old gallery's demo omitted it, which is how this was caught.
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
  configError,
  descriptionId,
  errorId,
  children,
}: FieldWrapperProps) {
  // A config that failed to load (its options, say) comes first: until it
  // loads, the field cannot be filled in, whatever its own check says. The
  // failure's message is the app's, so it says what failed in its words.
  const problem = configError ? configError.message || 'This field could not be loaded.' : error;
  // The ids are the form's: it points the input's `aria-describedby` at
  // whichever of the two lines is drawn.
  const help =
    description && !problem ? (
      <p id={descriptionId} className="text-12/17 text-gray-11 font-sans">
        {description}
      </p>
    ) : null;

  // Shown whenever the form gives one. The form already holds a problem back
  // until the field has been left or a submit tried, so a `touched` gate here
  // would only hide it again after a failed submit.
  const message = problem ? <FieldError id={errorId}>{problem}</FieldError> : null;

  return (
    <div className="@container">
      <div className="@form-labels:flex-row @form-labels:gap-12 flex flex-col gap-4">
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
          <div className="@form-labels:block @form-labels:w-104 @form-labels:shrink-0 hidden" />
        )}
        <div className="@form-labels:flex-1 flex min-w-0 flex-col gap-4">
          {children}
          {help}
          {message}
        </div>
      </div>
    </div>
  );
}
