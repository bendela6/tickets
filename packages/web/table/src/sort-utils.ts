import type { SortBy } from './types';

const next = (d: 'asc' | 'desc' | undefined): 'asc' | 'desc' | null => {
  return d === undefined ? 'asc' : d === 'asc' ? 'desc' : null;
};

export function toggleSort(current: SortBy[], field: string): SortBy[] {
  const existing = current[0]?.field === field ? current[0] : undefined;
  const direction = next(existing?.direction);
  return direction === null ? [] : [{ field, direction }];
}

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
