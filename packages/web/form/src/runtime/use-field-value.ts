import { useContext } from 'react';
import { useStore } from '@tanstack/react-form';
import { FormContext } from './form-context';

export function useFieldValue<T = unknown>(name: string): T {
  const form = useContext(FormContext);
  if (!form) {
    throw new Error('useFieldValue must be used inside <Form>');
  }
  return useStore(
    form.store as Parameters<typeof useStore>[0],
    (s: { values: Record<string, unknown> }) => s.values[name] as T,
  );
}
