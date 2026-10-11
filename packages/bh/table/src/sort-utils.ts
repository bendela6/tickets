import type { SortBy } from './types';

const next = (d: 'asc' | 'desc' | undefined): 'asc' | 'desc' | null => {
  return d === undefined ? 'asc' : d === 'asc' ? 'desc' : null;
};

/**
 * The sort after a plain header click: by `field` alone, its direction one
 * step on from asc → desc → none. `field` steps on only while it is the
 * primary key; otherwise it starts at asc.
 *
 * @param current The sort now. Left as it is.
 * @param field The clicked column's key.
 */
export function toggleSort(current: SortBy[], field: string): SortBy[] {
  const existing = current[0]?.field === field ? current[0] : undefined;
  const direction = next(existing?.direction);
  return direction === null ? [] : [{ field, direction }];
}

/**
 * The sort after a shift-click: `field` joins at the end, ascending, or steps
 * on in place, asc → desc → gone. The other keys keep their order.
 *
 * @param current The sort now. Left as it is.
 * @param field The shift-clicked column's key.
 */
export function multiSortToggle(current: SortBy[], field: string): SortBy[] {
  const existing = current.find((s) => s.field === field);
  if (!existing) {
    return [...current, { field, direction: 'asc' }];
  }
  const direction = next(existing.direction);
  if (direction === null) {
    return current.filter((s) => s.field !== field);
  }
  return current.map((s) => (s.field === field ? { field, direction } : s));
}
