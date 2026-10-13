// Which of a destination's pages is on screen. More than one can match — a
// first page at `/x` is a prefix of a second at `/x/y` — so the longest match
// wins, and exactly one page is lit.

import { isCurrentPath } from './is-current-path';
import type { NavLeaf } from './nav-types';

/**
 * The path of the page on screen, or undefined when none of them is.
 *
 * Of the pages the path on screen is at or under, the longest path wins.
 *
 * @param leaves A destination's pages.
 * @param currentPath The path on screen.
 */
export function currentLeaf(leaves: readonly NavLeaf[], currentPath: string): string | undefined {
  let best: string | undefined;
  for (const leaf of leaves) {
    if (
      isCurrentPath(leaf.path, currentPath) &&
      (best === undefined || leaf.path.length > best.length)
    ) {
      best = leaf.path;
    }
  }
  return best;
}
