import { act, render, renderHook, screen } from '@testing-library/react';
import { StrictMode, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useAction, type ActionOutcome } from './use-action';

/** A promise the test settles when it says. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

/** Starts a run inside act, and hands back its promise to await later. */
function start<Args extends unknown[], Result>(
  run: (...args: Args) => Promise<ActionOutcome<Result>>,
  ...args: Args
) {
  const started: { outcome?: Promise<ActionOutcome<Result>> } = {};
  act(() => {
    started.outcome = run(...args);
  });
  if (!started.outcome) {
    throw new Error('The run did not start.');
  }
  return started.outcome;
}

/** Lets the settled promises' callbacks run, inside act. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useAction', () => {
  it('starts idle, with no error and no result', () => {
    const { result } = renderHook(() => useAction(() => Promise.resolve(1)));
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.result).toBeUndefined();
  });

  it('is pending while the action runs, then holds what it resolved to', async () => {
    const save = deferred<string>();
    const action = vi.fn((name: string) => save.promise.then((id) => `${name}:${id}`));
    const { result } = renderHook(() => useAction(action));
    const outcome = start(result.current.run, 'ada');
    expect(action).toHaveBeenCalledWith('ada');
    expect(result.current.isPending).toBe(true);
    save.resolve('7');
    await settle();
    expect(result.current.isPending).toBe(false);
    expect(result.current.result).toBe('ada:7');
    await expect(outcome).resolves.toEqual({ ok: true, result: 'ada:7' });
  });

  it('holds the error a run threw, and resolves rather than rejects', async () => {
    const failure = new Error('That name is taken.');
    const { result } = renderHook(() => useAction(() => Promise.reject(failure)));
    const outcome = start(result.current.run);
    await settle();
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBe(failure);
    await expect(outcome).resolves.toEqual({ ok: false, error: failure });
  });

  it('catches an action that throws before it returns a promise', async () => {
    const { result } = renderHook(() => {
      return useAction((): Promise<number> => {
        throw new Error('No connection.');
      });
    });
    const outcome = start(result.current.run);
    await settle();
    expect(result.current.error?.message).toBe('No connection.');
    expect((await outcome).ok).toBe(false);
  });

  it('gives a thrown value that isn’t an Error as one, with the value as its cause', async () => {
    const { result } = renderHook(() => useAction(() => Promise.reject({ status: 409 })));
    void start(result.current.run);
    await settle();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('[object Object]');
    expect(result.current.error?.cause).toEqual({ status: 409 });
  });

  it('clears the error as the next run starts, and keeps the last result through a failure', async () => {
    let fail = false;
    const { result } = renderHook(() => {
      return useAction((n: number) => {
        return fail ? Promise.reject(new Error('No.')) : Promise.resolve(n);
      });
    });
    void start(result.current.run, 1);
    await settle();
    fail = true;
    void start(result.current.run, 2);
    await settle();
    expect(result.current.error?.message).toBe('No.');
    expect(result.current.result).toBe(1);
    fail = false;
    const save = start(result.current.run, 3);
    expect(result.current.error).toBeUndefined();
    await act(() => save);
    expect(result.current.result).toBe(3);
  });

  it('keeps only the latest run when a second starts before the first settles', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const queue = [first.promise, second.promise];
    const { result } = renderHook(() => useAction(() => queue.shift() ?? Promise.resolve('')));
    const earlier = start(result.current.run);
    const later = start(result.current.run);
    second.resolve('later');
    await settle();
    expect(result.current.result).toBe('later');
    expect(result.current.isPending).toBe(false);
    first.resolve('earlier');
    await settle();
    expect(result.current.result).toBe('later');
    // Each run's promise still says how that run went.
    await expect(earlier).resolves.toEqual({ ok: true, result: 'earlier' });
    await expect(later).resolves.toEqual({ ok: true, result: 'later' });
  });

  it('stays pending until the latest run settles', async () => {
    const first = deferred<number>();
    const second = deferred<number>();
    const queue = [first.promise, second.promise];
    const { result } = renderHook(() => useAction(() => queue.shift() ?? Promise.resolve(0)));
    void start(result.current.run);
    void start(result.current.run);
    first.resolve(1);
    await settle();
    expect(result.current.isPending).toBe(true);
    expect(result.current.result).toBeUndefined();
    second.resolve(2);
    await settle();
    expect(result.current.isPending).toBe(false);
  });

  it('forgets the error and the result on reset', async () => {
    let fail = false;
    const { result } = renderHook(() => {
      return useAction(() => (fail ? Promise.reject(new Error('No.')) : Promise.resolve('yes')));
    });
    void start(result.current.run);
    await settle();
    fail = true;
    void start(result.current.run);
    await settle();
    act(() => result.current.reset());
    expect(result.current.error).toBeUndefined();
    expect(result.current.result).toBeUndefined();
  });

  it('calls the latest action, and keeps run and reset for its life', async () => {
    const first = vi.fn(() => Promise.resolve(1));
    const second = vi.fn(() => Promise.resolve(2));
    const { result, rerender } = renderHook(({ action }) => useAction(action), {
      initialProps: { action: first },
    });
    const { run, reset } = result.current;
    rerender({ action: second });
    expect(result.current.run).toBe(run);
    expect(result.current.reset).toBe(reset);
    void start(result.current.run);
    await settle();
    expect(first).not.toHaveBeenCalled();
    expect(result.current.result).toBe(2);
  });

  it('changes nothing when a run settles after the component has gone', async () => {
    const save = deferred<number>();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result, unmount } = renderHook(() => useAction(() => save.promise));
    const outcome = start(result.current.run);
    unmount();
    save.resolve(5);
    await expect(outcome).resolves.toEqual({ ok: true, result: 5 });
    expect(result.current.isPending).toBe(true);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('counts a run a child starts as it mounts, under StrictMode', async () => {
    // A child's effects run before its parent's, so the run starts before
    // the hook's own effect has: it still counts.
    function Child({ go }: { go: () => Promise<unknown> }) {
      useEffect(() => {
        void go();
      }, [go]);
      return null;
    }
    function Saver() {
      const save = useAction(() => Promise.resolve('saved'));
      return (
        <>
          <Child go={save.run} />
          <output>{save.result ?? (save.isPending ? 'saving' : 'idle')}</output>
        </>
      );
    }
    render(
      <StrictMode>
        <Saver />
      </StrictMode>,
    );
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('saved');
  });
});
