import { createContext } from 'react';
import type { Commit } from '../types/commit';
import type { Commits } from './commits';
import type { ResetOptions } from '../types/action-node';

/** What `<Form>` gives its fields about committing: its commits, and when its fields commit. */
export interface CommitScope {
  commits: Commits;
  /** The form's `commit`, which each field's input is given. */
  commit?: Commit;
  /** Puts the values back and forgets the drafts: what a reset button does. */
  reset: (options?: ResetOptions) => void;
}

export const CommitContext = createContext<CommitScope | null>(null);
