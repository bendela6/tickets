import type { JsonRow } from '../types';

/**
 * The fold set a document opens at: every container at `depth` or deeper starts shut, so `depth`
 * is the number of levels on screen. `Infinity` opens the whole document; `1` leaves the root open
 * and nothing else, which is what collapse-all means here - folding the root itself would leave a
 * single line and nothing to aim at.
 */
export function collapsedByDepth(rows: JsonRow[], depth: number): Set<string> {
  const collapsed = new Set<string>();
  for (const row of rows) {
    if (row.container !== null && row.container.size > 0 && row.depth >= depth) {
      collapsed.add(row.path);
    }
  }
  return collapsed;
}
