import { describe, it, expect } from 'vitest';
import { toggleSort, multiSortToggle } from './sort-utils';

describe('toggleSort', () => {
  it('cycles asc → desc → none on the same field', () => {
    expect(toggleSort([], 'name')).toEqual([{ field: 'name', direction: 'asc' }]);
    expect(toggleSort([{ field: 'name', direction: 'asc' }], 'name')).toEqual([
      { field: 'name', direction: 'desc' },
    ]);
    expect(toggleSort([{ field: 'name', direction: 'desc' }], 'name')).toEqual([]);
  });

  it('replaces sort when a different field is clicked', () => {
    expect(toggleSort([{ field: 'name', direction: 'asc' }], 'createdAt')).toEqual([
      { field: 'createdAt', direction: 'asc' },
    ]);
  });
});

describe('multiSortToggle', () => {
  it('appends a secondary sort when shift-clicking a new column', () => {
    expect(multiSortToggle([{ field: 'name', direction: 'asc' }], 'createdAt')).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'createdAt', direction: 'asc' },
    ]);
  });

  it('cycles direction of an existing column without reordering', () => {
    const base = [
      { field: 'name', direction: 'asc' as const },
      { field: 'createdAt', direction: 'asc' as const },
    ];
    expect(multiSortToggle(base, 'name')).toEqual([
      { field: 'name', direction: 'desc' },
      { field: 'createdAt', direction: 'asc' },
    ]);
  });

  it('removes a column on its third shift-click (asc → desc → none)', () => {
    const base = [{ field: 'name', direction: 'desc' as const }];
    expect(multiSortToggle(base, 'name')).toEqual([]);
  });
});
