import { useEffect, useState } from 'react';

/** What `useNow` takes. Every option is optional: `useNow()`. */
export interface UseNowOptions {
  /** How often it ticks, in milliseconds: every second unless given. Each tick is on a whole multiple of it, as a clock's second hand is; one that is not above 0 never ticks. */
  interval?: number;
  /** Whether it ticks; while `false` it keeps the time it last had. `true` unless given. */
  enabled?: boolean;
}

type Listener = (now: number) => void;

// One clock for each interval, shared by every useNow on the page that ticks
// at it: one timer, so all of them move on the same tick.
interface Clock {
  listeners: Set<Listener>;
  timer: ReturnType<typeof setTimeout> | undefined;
}

const clocks = new Map<number, Clock>();

function tell(clock: Clock, now: number) {
  clock.listeners.forEach((listener) => listener(now));
}

/** Waits for the next whole multiple of `interval`, tells the listeners, and waits again. */
function schedule(interval: number, clock: Clock) {
  clock.timer = setTimeout(
    () => {
      tell(clock, Date.now());
      schedule(interval, clock);
    },
    interval - (Date.now() % interval),
  );
}

// A tab in the background has its timers slowed, so one coming back says
// the time at once, rather than at the next tick.
function onVisible() {
  if (document.visibilityState !== 'visible') {
    return;
  }
  const now = Date.now();
  clocks.forEach((clock, interval) => {
    clearTimeout(clock.timer);
    tell(clock, now);
    schedule(interval, clock);
  });
}

function subscribe(interval: number, listener: Listener): () => void {
  let clock = clocks.get(interval);
  if (!clock) {
    clock = { listeners: new Set(), timer: undefined };
    if (clocks.size === 0) {
      document.addEventListener('visibilitychange', onVisible);
    }
    clocks.set(interval, clock);
    schedule(interval, clock);
  }
  clock.listeners.add(listener);
  const own = clock;
  return () => {
    own.listeners.delete(listener);
    if (own.listeners.size === 0) {
      clearTimeout(own.timer);
      clocks.delete(interval);
      if (clocks.size === 0) {
        document.removeEventListener('visibilitychange', onVisible);
      }
    }
  };
}

/**
 * The time now, in milliseconds since the epoch as `Date.now()` gives it,
 * ticking every `interval`: a "saved 3 minutes ago", a countdown, a clock.
 * Every `useNow` on the page with the same interval ticks on the same timer,
 * on a whole multiple of the interval, so they move together and a minute's
 * clock turns on the minute. `new Date(now)` gives it as a date.
 *
 * Its server value is the time it renders at. A page built ahead of time
 * shows its build's time until the browser takes it over, so mark what
 * shows it with `suppressHydrationWarning`.
 */
export function useNow({ interval = 1000, enabled = true }: UseNowOptions = {}): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // An interval that is no positive number of milliseconds never ticks.
    if (!enabled || !(interval > 0)) {
      return undefined;
    }
    // Starting, or starting again, it says the time at once: kept as it is
    // while that is still within the same tick, so a mount renders nothing new.
    const take = (next: number) => {
      setNow((before) => {
        return Math.floor(before / interval) === Math.floor(next / interval) ? before : next;
      });
    };
    take(Date.now());
    return subscribe(interval, setNow);
  }, [interval, enabled]);
  return now;
}
