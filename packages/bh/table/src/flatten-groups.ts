import type { TableGroup, VirtualRow } from './types';

// Row indices run continuously across groups rather than restarting per group,
// so `onRowClick` and the `tr` slot's `index` stay unique for the whole table —
// a per-group index would collide the moment two groups both had a row 0.
//
// A collapsed group's rows do not consume indices either, so the indices handed
// out here are always dense over what is VISIBLE. That matters because every
// consumer downstream is positional: the virtualizer counts visible items, and
// cell focus moves by `rowIndex + 1`. Leaving gaps for hidden rows would make
// arrow-down step into a row that is not on screen. Selection is unaffected
// either way, being keyed on `getRowId` rather than position.
/**
 * The groups as one list of bands and rows, in order: the list the table
 * scrolls through. Each group's band comes first, then its rows, numbered
 * from 0 across all the groups.
 *
 * Every group keeps its band, an empty one and a collapsed one too, so a
 * section that has filtered down to nothing says so rather than vanishing. A
 * collapsed group's rows are left out, and take no numbers.
 *
 * @param groups The groups, in order.
 * @param collapsed The keys of the collapsed groups.
 */
export function flattenGroups<T>(
  groups: TableGroup<T>[],
  collapsed?: ReadonlySet<string>,
): VirtualRow<T>[] {
  const out: VirtualRow<T>[] = [];
  let index = 0;
  for (const group of groups) {
    out.push({ kind: 'group', key: group.key, header: group.header });
    if (collapsed?.has(group.key)) {
      continue;
    }
    for (const row of group.rows) {
      out.push({ kind: 'row', row, index });
      index += 1;
    }
  }
  return out;
}
