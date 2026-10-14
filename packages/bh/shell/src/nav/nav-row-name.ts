// A nav row's name for a screen reader. The link would be named by what it
// holds, and its label, count and status sit side by side with nothing
// between them: Home with a count of 2 was read "Home2" (Chrome added a space,
// "Home 2"; others didn't). Internal to the rows: not in the nav's index.

import { NAV_STATUS } from './nav-status';
import type { NavStatus } from './nav-types';

/**
 * The row's words apart, "Home, 2" or "Status, Up, with warnings", for its
 * `aria-label`; `undefined` for a row that is its label alone, which its
 * content names.
 */
export function navRowName(
  label: string,
  count: string | number | undefined,
  status?: NavStatus,
): string | undefined {
  const after = [count, status && NAV_STATUS[status].label].filter((part) => {
    return part !== undefined && part !== '';
  });
  return after.length === 0 ? undefined : [label, ...after].join(', ');
}
