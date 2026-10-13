import { useContext, useSyncExternalStore } from 'react';
import { CommitContext } from './commit-context';
import { NO_DRAFT } from './commits';
import { useFieldValue } from './use-field-value';

/**
 * What a field shows as it's typed: its draft before it commits, else its
 * value. `useFieldValue` gives the committed value, which a field set to
 * commit on leaving only gets when it's left. For anything drawn inside
 * `<Form>`; throws outside one.
 */
export function useFieldDraft<T = unknown>(name: string): T {
  const value = useFieldValue<T>(name);
  const scope = useContext(CommitContext);
  if (!scope) {
    throw new Error('useFieldDraft must be used inside <Form>');
  }
  const { commits } = scope;
  const draft = useSyncExternalStore(commits.subscribe, () => commits.draftOf(name));
  return draft === NO_DRAFT ? value : (draft as T);
}
