import { useSyncExternalStore } from 'react';
import { useSelector } from '@tanstack/react-form';
import { formStore } from '../utils/form-store';
import { sameValues, type Commits } from './commits';

/**
 * Whether the form's values differ from where a reset puts them: the values
 * last submitted, or the ones it started with. Dirty is this, in a form with
 * an `onSubmit`; a reset waits for it.
 */
export function useChanged(form: unknown, commits: Commits): boolean {
  const submitted = useSyncExternalStore(commits.subscribe, commits.baseline);
  const start = (form as { options: { defaultValues?: Record<string, unknown> } }).options
    .defaultValues;
  const store = (form as { store: unknown }).store;
  return useSelector(
    formStore<{ values: Record<string, unknown> }>(store),
    (s: { values: Record<string, unknown> }) => !sameValues(s.values, submitted ?? start ?? {}),
  );
}
