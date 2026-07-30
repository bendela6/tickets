import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTable } from './use-table';

beforeEach(() => localStorage.clear());

describe('useTable', () => {
  it('starts with an empty sort', () => {
    const { result } = renderHook(() => useTable());
    expect(result.current.state.sort).toEqual([]);
  });

  it('starts from the supplied initial sort', () => {
    const { result } = renderHook(() =>
      useTable({ initialSort: [{ field: 'name', direction: 'desc' }] }),
    );
    expect(result.current.state.sort).toEqual([{ field: 'name', direction: 'desc' }]);
  });

  // The handlers are shaped to be spread onto <Table> — the whole point is
  // that a caller writes no state wiring — so each has to actually move the
  // state it names.
  it('records a new sort', () => {
    const { result } = renderHook(() => useTable());
    act(() => result.current.onSortChange([{ field: 'count', direction: 'asc' }]));
    expect(result.current.state.sort).toEqual([{ field: 'count', direction: 'asc' }]);
  });

  it('keeps a multi-key sort whole', () => {
    const { result } = renderHook(() => useTable());
    act(() =>
      result.current.onSortChange([
        { field: 'name', direction: 'asc' },
        { field: 'count', direction: 'desc' },
      ]),
    );
    expect(result.current.state.sort).toHaveLength(2);
  });

  it('records a dragged column width', () => {
    const { result } = renderHook(() => useTable());
    act(() => result.current.onWidthChange('name', 240));
    expect(result.current.state.widths).toEqual({ name: 240 });
  });

  it('records collapsed groups', () => {
    const { result } = renderHook(() => useTable());
    act(() => result.current.onCollapseChange(new Set(['done'])));
    expect([...(result.current.state.collapsed ?? [])]).toEqual(['done']);
  });

  it('starts with the supplied collapsed groups', () => {
    const { result } = renderHook(() => useTable({ initialCollapsed: ['done'] }));
    expect([...(result.current.state.collapsed ?? [])]).toEqual(['done']);
  });
});

describe('useTable — width persistence', () => {
  it('persists widths under the given id', () => {
    const { result } = renderHook(() => useTable({ widthsId: 'demo' }));
    act(() => result.current.onWidthChange('name', 300));
    const { result: reopened } = renderHook(() => useTable({ widthsId: 'demo' }));
    expect(reopened.current.state.widths).toEqual({ name: 300 });
  });

  it("keeps two tables' widths apart", () => {
    const { result: a } = renderHook(() => useTable({ widthsId: 'a' }));
    act(() => a.current.onWidthChange('name', 300));
    const { result: b } = renderHook(() => useTable({ widthsId: 'b' }));
    expect(b.current.state.widths).toEqual({});
  });

  // A table with no id — a gallery demo, a test fixture, a one-off panel —
  // has no business writing to a user's localStorage. Widths still work, they
  // just live as long as the component does.
  it('does not touch localStorage without an id', () => {
    const { result } = renderHook(() => useTable());
    act(() => result.current.onWidthChange('name', 300));
    expect(result.current.state.widths).toEqual({ name: 300 });
    expect(localStorage.length).toBe(0);
  });
});
