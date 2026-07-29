import type { FieldWrapperProps } from '@tickets/form';
import { FieldError } from '../components/field-error';
import { FieldLabel } from '../components/field-label';
import { Stack } from '../components/stack';

/**
 * The registry's `field` slot: caption, control, then either the description
 * or the error.
 */
export function FieldWrapper({
  name,
  label,
  description,
  required,
  error,
  children,
}: FieldWrapperProps) {
  return (
    <Stack gap={1}>
      {label ? (
        <FieldLabel htmlFor={name} required={required}>
          {label}
        </FieldLabel>
      ) : null}
      {children}
      {description && !error ? (
        <p className="font-sans text-12/17 text-gray-11">{description}</p>
      ) : null}
      {error ? (
        // Shown as soon as the engine reports one. There is deliberately no
        // `touched` gate: in this stack `isTouched` flips only via setFieldValue,
        // so a field the user never edited — the case a gate is for — would keep
        // its message permanently invisible, including after a failed submit.
        <FieldError>{error}</FieldError>
      ) : null}
    </Stack>
  );
}
