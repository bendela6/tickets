import type { TableGroup, VirtualRow } from './types';

/**
 * Interleaves group headers with their rows into the single list the
 * virtualizer measures.
 *
 * Row indices run continuously across groups rather than restarting per group,
 * so `onRowClick` and the `tr` slot's `index` stay unique for the whole table —
 * a per-group index would collide the moment two groups both had a row 0.
 *
 * An empty group keeps its header: a section that filtered down to nothing
 * should say so rather than silently vanish. A COLLAPSED group keeps its header
 * for the same reason, and drops its rows.
 *
 * A collapsed group's rows do not consume indices either, so the indices handed
 * out here are always dense over what is VISIBLE. That matters because every
 * consumer downstream is positional: the virtualizer counts visible items, and
 * cell focus moves by `rowIndex + 1`. Leaving gaps for hidden rows would make
 * arrow-down step into a row that is not on screen. Selection is unaffected
 * either way, being keyed on `getRowId` rather than position.
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
