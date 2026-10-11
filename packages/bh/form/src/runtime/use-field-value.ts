import { useContext } from 'react';
import { useSelector } from '@tanstack/react-form';
import { formStore } from '../utils/form-store';
import { FormContext } from './form-context';

/**
 * A field's value as it is edited, for anything drawn inside `<Form>` (its
 * children, an input, a layout). Throws outside one.
 */
export function useFieldValue<T = unknown>(name: string): T {
  const form = useContext(FormContext);
  if (!form) {
    throw new Error('useFieldValue must be used inside <Form>');
  }
  return useSelector(
    formStore<{ values: Record<string, unknown> }>(form.store),
    (s: { values: Record<string, unknown> }) => s.values[name] as T,
  );
}
