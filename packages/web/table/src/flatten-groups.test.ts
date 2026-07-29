import { describe, expect, it } from 'vitest';
import { flattenGroups } from './flatten-groups';

const groups = [
  { key: 'a', header: 'Group A', rows: [{ id: '1' }, { id: '2' }] },
  { key: 'b', header: 'Group B', rows: [{ id: '3' }] },
];

describe('flattenGroups', () => {
  it('emits a header before each group and its rows after', () => {
    expect(flattenGroups(groups).map((i) => i.kind)).toEqual([
      'group', 'row', 'row', 'group', 'row',
    ]);
  });

  it('carries each group key onto its header item', () => {
    const items = flattenGroups(groups);
    expect(items[0]).toMatchObject({ kind: 'group', key: 'a' });
    expect(items[3]).toMatchObject({ kind: 'group', key: 'b' });
  });

  it('numbers rows continuously across groups so onRowClick indices are unique', () => {
    const indices = flattenGroups(groups)
      .filter((i) => i.kind === 'row')
      .map((i) => (i.kind === 'row' ? i.index : -1));
    expect(indices).toEqual([0, 1, 2]);
  });

  it('keeps a group with no rows so an empty section still announces itself', () => {
    const items = flattenGroups([{ key: 'empty', header: 'Empty', rows: [] }]);
    expect(items.map((i) => i.kind)).toEqual(['group']);
  });

  it('returns nothing for no groups', () => {
    expect(flattenGroups([])).toEqual([]);
  });
});
