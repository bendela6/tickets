import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './use-debounced-value';

// The plain view it drives, as on its page: a field, and what is searched for.
function Search() {
  const [text, setText] = useState('');
  const query = useDebouncedValue(text, { delay: 300 });
  return (
    <>
      <input aria-label="Search" value={text} onChange={(event) => setText(event.target.value)} />
      <output>{query === '' ? 'Nothing yet' : `Searching for ${query}`}</output>
    </>
  );
}

/** Moves the clock on by `ms`, and renders what that changed. */
function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('starts at the value', () => {
    const { result } = renderHook(() => useDebouncedValue('shoes', { delay: 300 }));
    expect(result.current).toBe('shoes');
  });

  it('follows the value once it stops changing for the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, { delay: 300 }),
      {
        initialProps: { value: 'a' },
      },
    );
    rerender({ value: 'ab' });
    wait(200);
    rerender({ value: 'abc' });
    wait(200);
    expect(result.current).toBe('a');
    wait(100);
    expect(result.current).toBe('abc');
  });

  it('keeps a function as the value, rather than calling it', () => {
    const first = () => 'first';
    const second = () => 'second';
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, { delay: 10 }),
      {
        initialProps: { value: first },
      },
    );
    rerender({ value: second });
    wait(10);
    expect(result.current).toBe(second);
  });

  it('settles once under StrictMode', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, { delay: 300 }),
      {
        initialProps: { value: 1 },
        wrapper: StrictMode,
      },
    );
    rerender({ value: 2 });
    wait(300);
    expect(result.current).toBe(2);
  });

  it('drives a plain view: searches once the typing stops', async () => {
    // user-event waits on real time between its steps; the clock moves with it.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    render(<Search />);
    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'boots');
    expect(screen.getByRole('status')).toHaveTextContent('Nothing yet');
    wait(300);
    expect(screen.getByRole('status')).toHaveTextContent('Searching for boots');
  });

  it('leaves no timer once unmounted', () => {
    const { rerender, unmount } = renderHook(
      ({ value }) => useDebouncedValue(value, { delay: 300 }),
      {
        initialProps: { value: 'a' },
      },
    );
    rerender({ value: 'b' });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
