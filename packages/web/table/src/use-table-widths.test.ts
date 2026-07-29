/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableWidths } from './use-table-widths';

describe('useTableWidths', () => {
  beforeEach(() => localStorage.clear());

  it('persists widths to localStorage and rehydrates on next mount', () => {
    const a = renderHook(() => useTableWidths('sites'));
    act(() => a.result.current[1]('name', 240));
    expect(JSON.parse(localStorage.getItem('tickets:table:sites:widths') ?? '{}')).toEqual({
      name: 240,
    });
    a.unmount();

    const b = renderHook(() => useTableWidths('sites'));
    expect(b.result.current[0]).toEqual({ name: 240 });
  });

  it('handles a corrupted localStorage entry gracefully', () => {
    localStorage.setItem('tickets:table:other:widths', 'not-json');
    const { result } = renderHook(() => useTableWidths('other'));
    expect(result.current[0]).toEqual({});
  });
});
