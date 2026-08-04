import type { Column, SortBy } from './types';

/**
 * `Intl.Collator` rather than `String.localeCompare` per comparison: the
 * collator is built once, and a 10,000-row sort makes ~130,000 comparisons.
 *
 * `numeric` gives "Item 9" before "Item 10", which is what a person means by
 * sorting a ticket list. `sensitivity: 'base'` makes case and accents tie, so
 * "alpha" and "Alpha" fall through to the stable tie-break rather than
 * interleaving by codepoint.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Nothing to compare. NaN is included on purpose: it compares `false`
 *  against every value including itself, so leaving it in the numeric branch
 *  makes the result depend on whatever order the rows arrived in. */
function isMissing(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v));
}

/** Present values only — `isMissing` is handled a level up, because missing
 *  values ignore the sort direction and this function must not. */
function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b);
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  // Everything else, including a mixed-type column, is compared as text. ISO
  // date strings sort correctly this way, which is why there is no separate
  // date-string branch.
  return collator.compare(String(a), String(b));
}

/**
 * The default comparator, which until now every caller had to write again.
 *
 * `Table` deliberately does NOT call this. The engine emits sort INTENT and
 * never reorders rows, which is exactly what lets a server-sorted table use
 * the same component — see the design's "One thing is already right". This is
 * the helper a client-sorted caller opts into:
 *
 *     <Table rows={sortRows(rows, state.sort, columns)} … />
 *
 * Three properties matter and each has a test:
 *
 * 1. **Every key, in order.** Shift-click has produced a multi-key `SortBy[]`
 *    since the engine was built, and the header has been rendering ordinals
 *    for an ordering that nothing implemented. This implements it.
 * 2. **Missing values sort last in BOTH directions.** The one deliberate
 *    break in asc/desc symmetry: sorting a mostly-empty column descending
 *    should not fill the first screen with blanks.
 * 3. **Stable.** Ties keep their input order, and the tie-break is applied
 *    outside the direction flip so a descending sort does not silently
 *    reverse every equal run.
 *
 * Rows are compared through `column.value`, so a column with only `render`
 * cannot be sorted by — it has no answer to "what IS this cell?" — and is
 * skipped rather than compared as `undefined`, which would flatten the table
 * into a single tie.
 *
 * Returns the SAME array when there is nothing to do, so a caller can hand
 * the result straight to a memo.
 */
export function sortRows<T>(rows: T[], sort: SortBy[], columns: Column<T>[]): T[] {
  if (sort.length === 0) {
    return rows;
  }

  const valueOf = new Map(columns.map((c) => [c.key, c.value]));
  const keys = sort.flatMap((s) => {
    const value = valueOf.get(s.field);
    return value ? [{ direction: s.direction, value }] : [];
  });
  if (keys.length === 0) {
    return rows;
  }

  // Decorate with the input index rather than trusting the engine's sort to
  // be stable. It is, since ES2019 — but the tie-break also has to survive
  // the direction flip above it, and a `0` return could not.
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const { direction, value } of keys) {
        const av = value(a.row);
        const bv = value(b.row);
        const aMissing = isMissing(av);
        const bMissing = isMissing(bv);
        if (aMissing || bMissing) {
          if (aMissing && bMissing) {
            continue;
          }
          return aMissing ? 1 : -1;
        }
        const cmp = compareValues(av, bv);
        if (cmp !== 0) {
          return direction === 'desc' ? -cmp : cmp;
        }
      }
      return a.index - b.index;
    })
    .map((d) => d.row);
}
