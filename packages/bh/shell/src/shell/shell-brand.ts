// What the app puts at the top of its sidebar and its phone bar.

import type { ReactNode } from 'react';

/** The app's mark and name, drawn at the top of its sidebar and in its phone's top bar. */
export interface ShellBrand {
  /** The mark, about 18px, already coloured the way the app wants it. */
  mark: ReactNode;
  /** The wordmark beside it, set in the mono face. */
  name: string;
  /** A small line under the name, e.g. `BuildLine`; only in the expanded sidebar. */
  caption?: ReactNode;
}
