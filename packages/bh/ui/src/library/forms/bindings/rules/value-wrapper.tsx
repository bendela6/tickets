import type { FieldWrapperProps } from '@bh/form';

/**
 * A rule's value and operator inputs, each drawn with its label for a screen
 * reader only: what is around them already says it, "Priority is any of".
 */
export function ValueWrapper({ name, label, error, errorId, children }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-4">
      {label ? (
        <label htmlFor={name} className="sr-only">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} className="text-12 text-red-11">
          {error}
        </p>
      ) : null}
    </div>
  );
}
