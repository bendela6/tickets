import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTreeView, type TreeNode } from './use-tree-view';

const ROOTS: TreeNode[] = [
  { id: 'a', children: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }] },
  { id: 'b', children: [] },
];

const key = (k: string) => ({ key: k, preventDefault: vi.fn() }) as never;

function setup(opts: Partial<Parameters<typeof useTreeView>[0]> = {}) {
  return renderHook(() => useTreeView({ roots: ROOTS, idPrefix: 't', ...opts }));
}

describe('useTreeView', () => {
  it('starts with only root rows visible', () => {
    const { result } = setup();
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('expanding reveals children at depth + 1', () => {
    const { result } = setup();
    act(() => result.current.toggle('a'));
    expect(result.current.rows.map((r) => [r.id, r.depth])).toEqual([
      ['a', 0], ['a1', 1], ['a2', 1], ['a3', 1], ['b', 0],
    ]);
  });

  it('reports hasChildren for an UNLOADED node so it still gets a caret', () => {
    // `children: undefined` means not loaded, not childless. A tree that hid
    // the caret here could never be expanded to trigger the load.
    const { result } = setup({ roots: [{ id: 'lazy' }] });
    expect(result.current.rows[0]!.hasChildren).toBe(true);
    // …and `children: []` is genuinely childless.
    const empty = setup({ roots: [{ id: 'leaf', children: [] }] });
    expect(empty.result.current.rows[0]!.hasChildren).toBe(false);
  });

  it('calls onExpand exactly once for an unloaded node, and not for a loaded one', () => {
    const onExpand = vi.fn();
    const { result } = setup({ roots: [{ id: 'lazy' }, { id: 'a', children: [{ id: 'a1' }] }], onExpand });
    act(() => result.current.toggle('lazy'));
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onExpand).toHaveBeenCalledWith('lazy');
    act(() => result.current.toggle('a'));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('collapsing does not re-fire onExpand', () => {
    const onExpand = vi.fn();
    const { result } = setup({ roots: [{ id: 'lazy' }], onExpand });
    act(() => result.current.toggle('lazy'));
    act(() => result.current.toggle('lazy'));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('select reports the id and moves focus to it', () => {
    const onSelect = vi.fn();
    const { result } = setup({ onSelect });
    act(() => result.current.select('b'));
    expect(onSelect).toHaveBeenCalledWith('b');
    expect(result.current.focusId).toBe('b');
  });

  it('ArrowDown and ArrowUp walk the visible rows', () => {
    const { result } = setup();
    act(() => result.current.onKeyDown(key('ArrowDown')));
    expect(result.current.focusId).toBe('b');
    act(() => result.current.onKeyDown(key('ArrowUp')));
    expect(result.current.focusId).toBe('a');
  });

  it('ArrowRight expands a collapsed node, then walks into it', () => {
    const { result } = setup();
    act(() => result.current.onKeyDown(key('ArrowRight')));
    expect(result.current.rows.map((r) => r.id)).toContain('a1');
    act(() => result.current.onKeyDown(key('ArrowRight')));
    expect(result.current.focusId).toBe('a1');
  });

  it('ArrowLeft collapses an expanded node', () => {
    const { result } = setup();
    act(() => result.current.toggle('a'));
    act(() => result.current.onKeyDown(key('ArrowLeft')));
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('ArrowLeft from the LAST child moves to the parent, not the previous sibling', () => {
    // The whole point: move(-1) would land on a2. The parent is the nearest
    // preceding row of strictly smaller depth.
    const { result } = setup();
    act(() => result.current.toggle('a'));
    act(() => result.current.setFocusId('a3'));
    act(() => result.current.onKeyDown(key('ArrowLeft')));
    expect(result.current.focusId).toBe('a');
  });

  it('Home and End jump to the ends', () => {
    const { result } = setup();
    act(() => result.current.onKeyDown(key('End')));
    expect(result.current.focusId).toBe('b');
    act(() => result.current.onKeyDown(key('Home')));
    expect(result.current.focusId).toBe('a');
  });

  it('Enter selects the focused row', () => {
    const onSelect = vi.fn();
    const { result } = setup({ onSelect });
    act(() => result.current.onKeyDown(key('ArrowDown')));
    act(() => result.current.onKeyDown(key('Enter')));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('skips inert rows when navigating, but still lists them', () => {
    const roots: TreeNode[] = [{ id: 'a', children: [{ id: 'note', inert: true }] }, { id: 'b' }];
    const { result } = renderHook(() => useTreeView({ roots, idPrefix: 't' }));
    act(() => result.current.toggle('a'));
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'note', 'b']);
    act(() => result.current.onKeyDown(key('ArrowDown')));
    expect(result.current.focusId).toBe('b');
  });

  it('calls preventDefault for a handled key', () => {
    const { result } = setup();
    const e = key('ArrowDown') as unknown as { preventDefault: () => void };
    act(() => result.current.onKeyDown(e as never));
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('namespaces row element ids by prefix so two trees never collide', () => {
    const { result } = setup();
    expect(result.current.rowElementId('a/b')).toBe('t-a%2Fb');
    expect(result.current.activeDescendant).toBe('t-a');
  });

  it('forceExpanded opens everything WITHOUT discarding the collapsed set', () => {
    // The filtered-tree case. It must be non-destructive: turning the filter
    // off has to restore exactly what the user had collapsed, so this cannot
    // be implemented by expanding the set and cannot be a loop of toggle().
    const { result, rerender } = renderHook(
      ({ force }: { force: boolean }) => useTreeView({ roots: ROOTS, idPrefix: 't', forceExpanded: force }),
      { initialProps: { force: false } },
    );
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']);
    rerender({ force: true });
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'a1', 'a2', 'a3', 'b']);
    rerender({ force: false });
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']);
  });
});
