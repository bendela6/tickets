import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** How a run went: what the action resolved to, or the error it threw. */
export type ActionOutcome<Result> = { ok: true; result: Result } | { ok: false; error: Error };

/** What `useAction` gives back: state, then actions. */
export interface UseActionResult<Args extends unknown[], Result> {
  /** Whether a run is going: from the call until it settles. */
  isPending: boolean;
  /** What the last run threw, until the next run starts or `reset`. A thrown value that isn't an `Error` comes as one, with the value as its `cause`. */
  error: Error | undefined;
  /** What the last run that worked resolved to, until `reset`: a run that fails leaves it as it was. */
  result: Result | undefined;
  /** Runs the action with these arguments. It never rejects: it resolves to how the run went, which a caller that goes on afterwards reads. The same function for the hook's life. */
  run: (...args: Args) => Promise<ActionOutcome<Result>>;
  /** Forgets the last error and result. A run still going keeps going. The same function for the hook's life. */
  reset: () => void;
}

interface Held<Result> {
  isPending: boolean;
  error: Error | undefined;
  result: Result | undefined;
}

/** The thrown value as an `Error`: as it is, or wrapped, with it as the cause. */
function asError(thrown: unknown): Error {
  return thrown instanceof Error ? thrown : new Error(String(thrown), { cause: thrown });
}

/**
 * An async action run from the page, a save or a send, with whether it is
 * going and what went wrong: `isPending` to disable the button and say so,
 * `error` to show, and `result` for what the last run gave back. It draws
 * nothing: the caller shows the three and calls `run`.
 *
 * `run` never rejects, so an event handler calls it with `void` and nothing
 * goes unhandled; a caller that goes on afterwards, to close a dialog or
 * clear a field, awaits it and reads `ok`. The action is read when `run`
 * is called, so it needs no `useCallback`.
 *
 * A run started while one is going supersedes it: only the latest run's
 * error or result is kept, and `isPending` holds until it settles. Its
 * server value is idle, with no error and no result. A run that settles
 * after the component has gone changes nothing, and its promise still
 * resolves.
 *
 * @param action What to run: a function that returns a promise, or a value.
 */
export function useAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result> | Result,
): UseActionResult<Args, Result> {
  const [held, setHeld] = useState<Held<Result>>({
    isPending: false,
    error: undefined,
    result: undefined,
  });

  // What run calls when it runs, written after each commit.
  const live = useRef(action);
  useLayoutEffect(() => {
    live.current = action;
  });

  // The latest run's number: an earlier one that settles after it is dropped.
  const latest = useRef(0);
  // Whether the component has gone: false from the first render, so a run
  // called before the effects have run, from a child's, still counts.
  const gone = useRef(false);
  useEffect(() => {
    gone.current = false;
    return () => {
      gone.current = true;
    };
  }, []);

  const run = useCallback(async (...args: Args): Promise<ActionOutcome<Result>> => {
    latest.current += 1;
    const id = latest.current;
    setHeld((now) => ({ ...now, isPending: true, error: undefined }));
    let outcome: ActionOutcome<Result>;
    try {
      // Awaited inside the try, so an action that throws before it returns
      // a promise is caught the same as one that rejects.
      outcome = { ok: true, result: await live.current(...args) };
    } catch (thrown) {
      outcome = { ok: false, error: asError(thrown) };
    }
    if (!gone.current && id === latest.current) {
      setHeld((now) => {
        return outcome.ok
          ? { isPending: false, error: undefined, result: outcome.result }
          : { ...now, isPending: false, error: outcome.error };
      });
    }
    return outcome;
  }, []);

  const reset = useCallback(() => {
    setHeld((now) => ({ ...now, error: undefined, result: undefined }));
  }, []);

  return { ...held, run, reset };
}
