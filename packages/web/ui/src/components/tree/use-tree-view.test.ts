import { act, renderHook } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
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

function strictWrapper() {
  return ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);
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

  // Guards the ref-mirror shape of `toggle`: under StrictMode, React
  // double-invokes state-updater functions to surface impure updaters. If
  // `onExpand` were called from inside `setExceptions`'s updater body —
  // instead of once, outside it, after deciding from a ref read — a single
  // toggle would fire onExpand twice. Mirrors the equivalent guard in
  // apps/web/src/ui/use-directory-tree.test.ts
  // ("StrictMode: a single expand fetches the path exactly once").
  it('StrictMode: a single toggle fires onExpand exactly once', () => {
    const onExpand = vi.fn();
    const { result } = renderHook(() => useTreeView({ roots: [{ id: 'lazy' }], idPrefix: 't', onExpand }), {
      wrapper: strictWrapper(),
    });
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
    // An inert row has `children: undefined` (unloaded shape) but must never
    // report a caret — there is nothing under it to load or reveal.
    expect(result.current.rows.find((r) => r.id === 'note')?.hasChildren).toBe(false);
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

  it('toggling a force-opened row records a collapse, not an expand, so turning force off restores it', () => {
    // `toggle` used to read raw set membership (ignoring `forceExpanded`), so
    // clicking a caret on a row that was only visually open because of
    // `forceExpanded` got recorded as an EXPAND. The row looked unchanged
    // while forcing stayed on, but once the filter cleared, the row the user
    // had just tried to close came back open.
    const { result, rerender } = renderHook(
      ({ force }: { force: boolean }) => useTreeView({ roots: ROOTS, idPrefix: 't', forceExpanded: force }),
      { initialProps: { force: true } },
    );
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'a1', 'a2', 'a3', 'b']);
    act(() => result.current.toggle('a'));
    // Still forced open — no visible change while forcing is still on.
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'a1', 'a2', 'a3', 'b']);
    rerender({ force: false });
    expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('typeahead jumps to the next row whose label starts with the pressed letter, wrapping around', () => {
    const roots: TreeNode[] = [
      { id: 'x', label: 'apple' },
      { id: 'y', label: 'banana' },
      { id: 'z', label: 'avocado' },
    ];
    const { result } = renderHook(() => useTreeView({ roots, idPrefix: 't' }));
    expect(result.current.focusId).toBe('x');
    act(() => result.current.onKeyDown(key('a')));
    // Search starts AFTER the focused row, so the first 'a' skips 'apple'
    // itself and lands on the next label starting with 'a'.
    expect(result.current.focusId).toBe('z');
    act(() => result.current.onKeyDown(key('a')));
    // Wraps back around past the end to 'apple'.
    expect(result.current.focusId).toBe('x');
  });

  describe('defaultExpanded', () => {
    it('renders every node expanded by default when defaultExpanded is true', () => {
      const { result } = setup({ defaultExpanded: true });
      expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'a1', 'a2', 'a3', 'b']);
    });

    it('toggle collapses a single node under defaultExpanded, without a mount-time sweep of toggle() calls', () => {
      const { result } = setup({ defaultExpanded: true });
      act(() => result.current.toggle('a'));
      // 'a' itself is still a row — only its children stop being walked.
      expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']);
      // The exception is per-node: toggling again reopens exactly that node.
      act(() => result.current.toggle('a'));
      expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'a1', 'a2', 'a3', 'b']);
    });

    it('ArrowLeft on a CHILDLESS row reaches the parent in one press, not two', () => {
      // A row with `children: []` can never be expanded — under
      // `defaultExpanded: true` it still computed `expanded: true` from the
      // baseline polarity alone, with nothing considering whether it actually
      // has children. ArrowLeft's `if (row.expanded) toggle(...)` branch then
      // fired on a leaf instead of walking to the parent, so the very first
      // press was swallowed (it only ever recorded a bogus collapse
      // exception) and the user had to press ArrowLeft twice.
      const roots: TreeNode[] = [{ id: 'a', children: [{ id: 'a1', children: [] }] }];
      const { result } = renderHook(() => useTreeView({ roots, idPrefix: 't', defaultExpanded: true }));
      act(() => result.current.setFocusId('a1'));
      act(() => result.current.onKeyDown(key('ArrowLeft')));
      expect(result.current.focusId).toBe('a');
    });

    it('composes with forceExpanded, which overrides on top of the default-open polarity', () => {
      const { result, rerender } = renderHook(
        ({ force }: { force: boolean }) =>
          useTreeView({ roots: ROOTS, idPrefix: 't', defaultExpanded: true, forceExpanded: force }),
        { initialProps: { force: false } },
      );
      act(() => result.current.toggle('a'));
      expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']);
      rerender({ force: true });
      expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'a1', 'a2', 'a3', 'b']);
      rerender({ force: false });
      expect(result.current.rows.map((r) => r.id)).toEqual(['a', 'b']);
    });
  });

  describe('the async seam under defaultExpanded / forceExpanded', () => {
    // A node with `children: undefined` (NOT LOADED) that renders open via
    // `defaultExpanded` or `forceExpanded` was never asked for — nobody ever
    // called `toggle()` on it, so the branch that fires `onExpand` never ran.
    // The row just sat there `expanded: true, hasChildren: true`, unloaded,
    // forever. This must be a load request exactly like a manual expand is.

    it('fires onExpand on mount for an unloaded root that starts open via defaultExpanded', () => {
      const onExpand = vi.fn();
      renderHook(() => useTreeView({ roots: [{ id: 'lazy' }], idPrefix: 't', defaultExpanded: true, onExpand }));
      expect(onExpand).toHaveBeenCalledTimes(1);
      expect(onExpand).toHaveBeenCalledWith('lazy');
    });

    it('fires onExpand on mount for an unloaded root that is force-expanded', () => {
      const onExpand = vi.fn();
      renderHook(() => useTreeView({ roots: [{ id: 'lazy' }], idPrefix: 't', forceExpanded: true, onExpand }));
      expect(onExpand).toHaveBeenCalledTimes(1);
      expect(onExpand).toHaveBeenCalledWith('lazy');
    });

    it('does not fire for a node that is unloaded but NOT effectively expanded', () => {
      const onExpand = vi.fn();
      renderHook(() => useTreeView({ roots: [{ id: 'lazy' }], idPrefix: 't', onExpand }));
      expect(onExpand).not.toHaveBeenCalled();
    });

    it('does not re-fire for the same id while its load is still outstanding', () => {
      // Focus and selection changes recompute `rows` (and so `toLoad`) on
      // every render — the guard has to survive re-renders that have nothing
      // to do with loading, not just survive being called twice in a row.
      const onExpand = vi.fn();
      // 'b' has `children: []` — genuinely childless, not a second load
      // candidate — so the only id ever pending here is 'lazy'.
      const { result } = renderHook(() =>
        useTreeView({
          roots: [{ id: 'lazy' }, { id: 'b', children: [] }],
          idPrefix: 't',
          defaultExpanded: true,
          onExpand,
        }),
      );
      expect(onExpand).toHaveBeenCalledTimes(1);
      act(() => result.current.setFocusId('b'));
      act(() => result.current.setFocusId('lazy'));
      expect(onExpand).toHaveBeenCalledTimes(1);
    });

    it('StrictMode: an unloaded, defaultExpanded root fires onExpand exactly once on mount', () => {
      const onExpand = vi.fn();
      renderHook(() => useTreeView({ roots: [{ id: 'lazy' }], idPrefix: 't', defaultExpanded: true, onExpand }), {
        wrapper: strictWrapper(),
      });
      expect(onExpand).toHaveBeenCalledTimes(1);
    });

    it('collapsing a defaultExpanded-open unloaded node adds no onExpand call of its own', () => {
      // Collapsing never loads. This pins that the pending-load bookkeeping
      // added for the mount-driven fire doesn't leak an extra call into an
      // unrelated toggle just because the id was recently pending.
      const onExpand = vi.fn();
      const { result } = renderHook(() =>
        useTreeView({ roots: [{ id: 'a', children: [{ id: 'lazy' }] }], idPrefix: 't', defaultExpanded: true, onExpand }),
      );
      // 'a' has real children, so mount fires nothing for it; 'lazy' is
      // unloaded and opens along with 'a' — this is the mount-driven fire.
      expect(onExpand).toHaveBeenCalledTimes(1);
      onExpand.mockClear();
      act(() => result.current.toggle('lazy'));
      expect(onExpand).not.toHaveBeenCalled();
    });
  });
});
