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

describe('flattenGroups — collapsed', () => {
  it('keeps a collapsed group header but drops its rows', () => {
    const items = flattenGroups(groups, new Set(['a']));
    expect(items.filter((i) => i.kind === 'group').map((i) => (i.kind === 'group' ? i.key : ''))).toEqual(
      ['a', 'b'],
    );
    expect(items.filter((i) => i.kind === 'row')).toHaveLength(1);
  });

  // Everything downstream is positional — the virtualizer counts visible items
  // and cell focus moves by `rowIndex + 1`. A gap where a hidden row used to be
  // would make arrow-down step onto a row that is not on screen.
  it('leaves no index gap where a collapsed group used to be', () => {
    const indices = flattenGroups(groups, new Set(['a']))
      .filter((i) => i.kind === 'row')
      .map((i) => (i.kind === 'row' ? i.index : -1));
    expect(indices).toEqual([0]);
  });

  it('is unchanged by a collapsed key that matches no group', () => {
    expect(flattenGroups(groups, new Set(['nope']))).toEqual(flattenGroups(groups));
  });

  it('drops every row when all groups collapse', () => {
    const items = flattenGroups(groups, new Set(['a', 'b']));
    expect(items.every((i) => i.kind === 'group')).toBe(true);
  });
});
