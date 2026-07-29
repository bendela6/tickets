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
 * should say so rather than silently vanish.
 */
export function flattenGroups<T>(groups: TableGroup<T>[]): VirtualRow<T>[] {
  const out: VirtualRow<T>[] = [];
  let index = 0;
  for (const group of groups) {
    out.push({ kind: 'group', key: group.key, header: group.header });
    for (const row of group.rows) {
      out.push({ kind: 'row', row, index });
      index += 1;
    }
  }
  return out;
}
