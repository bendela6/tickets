import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedCallback, type UseDebouncedCallbackOptions } from './use-debounced-callback';

// The plain view it drives, as on its page: a note saved once the typing stops.
function Note({ onSave }: { onSave: (text: string) => void }) {
  const [text, setText] = useState('');
  const save = useDebouncedCallback(onSave, { delay: 500 });
  return (
    <>
      <textarea
        aria-label="Note"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          save.run(event.target.value);
        }}
      />
      <output>{save.isPending ? 'Unsaved' : 'Saved'}</output>
      <button type="button" onClick={save.flush}>
        Save now
      </button>
    </>
  );
}

function debounced(options: UseDebouncedCallbackOptions = { delay: 300 }) {
  const callback = vi.fn<(value: string) => void>();
  const hook = renderHook(() => useDebouncedCallback(callback, options));
  return { callback, ...hook };
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

describe('useDebouncedCallback', () => {
  it('waits for nothing at first', () => {
    const { result } = debounced();
    expect(result.current.isPending).toBe(false);
  });

  it('calls once the calls stop for the delay, with the last call’s arguments', () => {
    const { callback, result } = debounced();
    act(() => result.current.run('a'));
    wait(200);
    act(() => result.current.run('ab'));
    expect(result.current.isPending).toBe(true);
    wait(299);
    expect(callback).not.toHaveBeenCalled();
    wait(1);
    expect(callback.mock.calls).toEqual([['ab']]);
    expect(result.current.isPending).toBe(false);
  });

  it('makes the waiting call now on flush, and drops it on cancel', () => {
    const { callback, result } = debounced();
    act(() => result.current.run('a'));
    act(() => result.current.flush());
    expect(callback.mock.calls).toEqual([['a']]);
    act(() => result.current.run('b'));
    act(() => result.current.cancel());
    wait(1000);
    expect(callback.mock.calls).toEqual([['a']]);
    expect(result.current.isPending).toBe(false);
  });

  it('does nothing on flush or cancel with nothing waiting', () => {
    const { callback, result } = debounced();
    act(() => result.current.flush());
    act(() => result.current.cancel());
    expect(callback).not.toHaveBeenCalled();
  });

  it('calls at the start of a burst too, when leading', () => {
    const { callback, result } = debounced({ delay: 300, leading: true });
    act(() => result.current.run('a'));
    expect(callback.mock.calls).toEqual([['a']]);
    expect(result.current.isPending).toBe(false);
    wait(300);
    expect(callback).toHaveBeenCalledTimes(1);
    act(() => result.current.run('b'));
    act(() => result.current.run('c'));
    wait(300);
    expect(callback.mock.calls).toEqual([['a'], ['b'], ['c']]);
  });

  it('calls at least every maxWait while the calls keep coming', () => {
    const { callback, result } = debounced({ delay: 300, maxWait: 1000 });
    for (let tick = 0; tick < 6; tick += 1) {
      act(() => result.current.run(String(tick)));
      wait(200);
    }
    expect(callback.mock.calls).toEqual([['4']]);
  });

  it('calls the latest callback, memoised or not', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ callback }) => useDebouncedCallback(callback, { delay: 300 }),
      { initialProps: { callback: first } },
    );
    act(() => result.current.run());
    rerender({ callback: second });
    wait(300);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps each action for its life', () => {
    const { result, rerender } = debounced();
    const { run, flush, cancel } = result.current;
    act(() => run('a'));
    rerender();
    expect(result.current.run).toBe(run);
    expect(result.current.flush).toBe(flush);
    expect(result.current.cancel).toBe(cancel);
  });

  it('calls once under StrictMode', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, { delay: 300 }), {
      wrapper: StrictMode,
    });
    act(() => result.current.run());
    wait(300);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  describe('once unmounted', () => {
    it('drops the waiting call, and leaves no timer', () => {
      const { callback, result, unmount } = debounced({ delay: 300, maxWait: 1000 });
      act(() => result.current.run('a'));
      unmount();
      expect(vi.getTimerCount()).toBe(0);
      wait(1000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('makes the waiting call at once, with onUnmount: flush', () => {
      const { callback, result, unmount } = debounced({ delay: 300, onUnmount: 'flush' });
      act(() => result.current.run('a'));
      unmount();
      expect(callback.mock.calls).toEqual([['a']]);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it('drives a plain view: saves once the typing stops, or at once', async () => {
    // user-event waits on real time between its steps; the clock moves with it.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const onSave = vi.fn();
    render(<Note onSave={onSave} />);
    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'Hi');
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved');
    wait(500);
    expect(onSave.mock.calls).toEqual([['Hi']]);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    await user.type(screen.getByRole('textbox', { name: 'Note' }), '!');
    await user.click(screen.getByRole('button', { name: 'Save now' }));
    expect(onSave.mock.calls).toEqual([['Hi'], ['Hi!']]);
  });
});
