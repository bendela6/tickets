import type { FieldWrapperProps } from '@tickets/form';
import { cn } from '../style';
import { FieldError } from '../components/field-error';
import { FieldLabel } from '../components/field-label';
import { Stack } from '../components/stack';

/**
 * The registry's `field` slot: caption, control, then either the description
 * or the error.
 *
 * The error paragraph stays mounted whenever `error` is set and only its
 * opacity flips on `touched`. Unmounting it instead would make every field
 * change height the moment validation fires, so a form that fails on submit
 * would jump under the user's cursor.
 */
export function FieldWrapper({
  name,
  label,
  description,
  required,
  error,
  touched,
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
        <FieldError className={cn(touched ? 'opacity-100' : 'opacity-0')}>{error}</FieldError>
      ) : null}
    </Stack>
  );
}
