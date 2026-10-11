// Row selection arithmetic. Pure, so the rules can be checked without a DOM —
// the interesting part of selection is which ids end up in the set, not which
// checkbox drew a tick.
//
// Selection is by ROW ID, not row index. Under sorting, filtering and (later)
// windowed loading, the row at index 4 is not the same row it was a moment
// ago; a selection keyed on position would silently follow the position
// rather than the thing the user picked. `getRowId` is what makes that
// possible, and is why selection is off without it.

/**
 * The selection with one row ticked, or unticked if it was: a click on its box.
 *
 * @param selected The selected row ids now. Left as it is.
 * @param id The row's id.
 */
export function toggleSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

// A range that toggled each row individually would punch holes in an existing
// selection, which is not what anybody means by dragging a range.
/**
 * The selection with every row of a range added: a shift-click. It never
 * takes a row out.
 *
 * @param selected The selected row ids now. Left as it is.
 * @param ids The range's row ids.
 */
export function extendSelection(selected: ReadonlySet<string>, ids: string[]): Set<string> {
  const next = new Set(selected);
  for (const id of ids) {
    next.add(id);
  }
  return next;
}

// A partially selected table's header completes the selection rather than
// throwing it away, which is the one thing an accidental click there must
// not do.
/**
 * The selection after a click on the header's box: every row added while any
 * is missing, and every row taken out only when all of them were in.
 *
 * @param selected The selected row ids now. Left as it is.
 * @param ids Every row the table holds. Ids outside it are left alone.
 */
export function toggleAll(selected: ReadonlySet<string>, ids: string[]): Set<string> {
  const everything = ids.every((id) => selected.has(id));
  if (!everything) {
    return extendSelection(selected, ids);
  }
  const next = new Set(selected);
  for (const id of ids) {
    next.delete(id);
  }
  return next;
}

/**
 * How the header's box shows: `checked` when every row is selected,
 * `indeterminate` when some are, neither when none are or there are no rows.
 *
 * @param selected The selected row ids.
 * @param ids Every row the table holds.
 */
export function selectionOf(
  selected: ReadonlySet<string>,
  ids: string[],
): { checked: boolean; indeterminate: boolean } {
  if (ids.length === 0) {
    return { checked: false, indeterminate: false };
  }
  let hits = 0;
  for (const id of ids) {
    if (selected.has(id)) {
      hits += 1;
    }
  }
  return { checked: hits === ids.length, indeterminate: hits > 0 && hits < ids.length };
}

/**
 * Every index from one to the other, both included, in either order:
 * `rangeBetween(5, 2)` is `[2, 3, 4, 5]`.
 *
 * @param a One end.
 * @param b The other.
 */
export function rangeBetween(a: number, b: number): number[] {
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
