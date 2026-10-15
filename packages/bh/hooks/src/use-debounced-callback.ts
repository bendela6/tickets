import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** What `useDebouncedCallback` takes after the callback. */
export interface UseDebouncedCallbackOptions {
  /** How long the calls must stop for, in milliseconds, before the last one is made. */
  delay: number;
  /** The longest a call waits, in milliseconds, however long the calls keep coming. No limit unless given. */
  maxWait?: number;
  /** Make the first call of a burst at once too, not only the last one once the burst ends. */
  leading?: boolean;
  /** What a call still waiting when the component unmounts does: it is dropped (`cancel`, unless given), or made at once (`flush`). */
  onUnmount?: 'cancel' | 'flush';
}

/** What `useDebouncedCallback` gives back: state, then actions. */
export interface UseDebouncedCallbackResult<Args extends unknown[]> {
  /** Whether a call is waiting to be made. */
  isPending: boolean;
  /** Calls the callback once the calls stop for `delay`, with the last call's arguments. The same function for the hook's life, as every action is. */
  run: (...args: Args) => void;
  /** Makes the waiting call now, if there is one. */
  flush: () => void;
  /** Drops the waiting call, if there is one. */
  cancel: () => void;
}

/** A burst of calls: the arguments waiting, if any, and its timers. */
interface Burst<Args> {
  args: Args | undefined;
  timer: ReturnType<typeof setTimeout> | undefined;
  maxTimer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * A callback made once its calls stop for `delay` milliseconds, with the
 * last call's arguments: a draft saved once the typing stops, a filter sent
 * once a slider rests. `flush` makes the waiting call now, `cancel` drops
 * it, and `isPending` says whether one is waiting.
 *
 * The callback is read when it is called, so it need not be memoised, and
 * changing it starts no wait again. Its server value: nothing waiting.
 *
 * @param callback What to call.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  { delay, maxWait, leading = false, onUnmount = 'cancel' }: UseDebouncedCallbackOptions,
): UseDebouncedCallbackResult<Args> {
  const [isPending, setIsPending] = useState(false);

  // What the actions read when they run, written after each commit.
  const live = useRef({ callback, delay, maxWait, leading, onUnmount });
  useLayoutEffect(() => {
    live.current = { callback, delay, maxWait, leading, onUnmount };
  });
  const burst = useRef<Burst<Args> | null>(null);

  /** Ends the burst, and hands back the arguments it was waiting with. */
  const end = useCallback((): Args | undefined => {
    const now = burst.current;
    if (!now) {
      return undefined;
    }
    clearTimeout(now.timer);
    clearTimeout(now.maxTimer);
    burst.current = null;
    setIsPending(false);
    return now.args;
  }, []);

  const flush = useCallback(() => {
    const args = end();
    if (args) {
      live.current.callback(...args);
    }
  }, [end]);

  const cancel = useCallback(() => {
    end();
  }, [end]);

  const run = useCallback(
    (...args: Args) => {
      const options = live.current;
      let now = burst.current;
      if (now) {
        now.args = args;
      } else {
        now = { args, timer: undefined, maxTimer: undefined };
        burst.current = now;
        if (options.leading) {
          // Made now, so nothing waits unless another call comes.
          now.args = undefined;
          options.callback(...args);
        }
        if (options.maxWait !== undefined) {
          now.maxTimer = setTimeout(flush, options.maxWait);
        }
      }
      clearTimeout(now.timer);
      now.timer = setTimeout(flush, options.delay);
      setIsPending(now.args !== undefined);
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      if (live.current.onUnmount === 'flush') {
        flush();
      } else {
        cancel();
      }
    };
  }, [flush, cancel]);

  return { isPending, run, flush, cancel };
}
