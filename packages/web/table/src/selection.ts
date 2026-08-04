/**
 * Row selection arithmetic. Pure, so the rules can be checked without a DOM —
 * the interesting part of selection is which ids end up in the set, not which
 * checkbox drew a tick.
 *
 * Selection is by ROW ID, not row index. Under sorting, filtering and (later)
 * windowed loading, the row at index 4 is not the same row it was a moment
 * ago; a selection keyed on position would silently follow the position
 * rather than the thing the user picked. `getRowId` is what makes that
 * possible, and is why selection is off without it.
 */

/** One row on or off. */
export function toggleSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/**
 * Shift-click. Adds the whole run and never removes: a range that toggled
 * each row individually would punch holes in an existing selection, which is
 * not what anybody means by dragging a range.
 */
export function extendSelection(selected: ReadonlySet<string>, ids: string[]): Set<string> {
  const next = new Set(selected);
  for (const id of ids) {
    next.add(id);
  }
  return next;
}

/**
 * The header checkbox. Selects everything if anything is unselected, clears
 * otherwise — so a partially selected table's header completes the selection
 * rather than throwing it away, which is the one thing an accidental click
 * there must not do.
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

/** Header checkbox state: all / some / none of `ids`. */
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

/** Inclusive index range, in either direction. */
export function rangeBetween(a: number, b: number): number[] {
  const from = Math.min(a, b);
  const to = Math.max(a, b);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
