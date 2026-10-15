import { useSyncExternalStore } from 'react';
import { useSelector } from '@tanstack/react-form';
import { formStore } from '../utils/form-store';
import { sameValues, type Commits } from './commits';
import type { ResetTo } from '../types/action-node';

/**
 * Whether the form's values differ from where a reset puts them: the values
 * last submitted, or the ones it started with; with `to: 'start'`, the ones
 * it started with. Dirty is this, in a form with an `onSubmit`; a reset waits
 * for it.
 */
export function useChanged(form: unknown, commits: Commits, to: ResetTo = 'submitted'): boolean {
  const last = useSyncExternalStore(commits.subscribe, commits.baseline);
  const submitted = to === 'start' ? undefined : last;
  const start = (form as { options: { defaultValues?: Record<string, unknown> } }).options
    .defaultValues;
  const store = (form as { store: unknown }).store;
  return useSelector(
    formStore<{ values: Record<string, unknown> }>(store),
    (s: { values: Record<string, unknown> }) => !sameValues(s.values, submitted ?? start ?? {}),
  );
}
