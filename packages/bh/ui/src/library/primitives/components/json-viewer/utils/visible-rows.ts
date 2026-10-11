import type { JsonRow } from '../types';

/** One line as it is drawn. */
export interface VisibleRow {
  row: JsonRow;
  /**
   * Which line of the unfolded document this is, 1-based. The gutter skips across a fold rather
   * than renumbering, the way an editor does: the number names a line of the document, so a parse
   * error reported at line 42 stays findable however much is folded above it.
   */
  line: number;
}

/** The lines on screen, given what is folded shut. */
export function visibleRows(rows: JsonRow[], collapsed: ReadonlySet<string>): VisibleRow[] {
  const visible: VisibleRow[] = [];
  // Everything up to and including this index is inside a fold. A nested fold never widens it:
  // its own row is skipped before it gets the chance.
  let hiddenThrough = -1;
  rows.forEach((row, index) => {
    if (index <= hiddenThrough) {
      return;
    }
    visible.push({ row, line: index + 1 });
    if (row.container !== null && row.container.size > 0 && collapsed.has(row.path)) {
      // The folded line draws its own closing bracket, so the closing row goes with the members.
      hiddenThrough = row.container.closeRow;
    }
  });
  return visible;
}
