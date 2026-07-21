import type { Signal } from './types';

export interface TransportOptions {
  url: string;
  fetchFn?: (url: string, init: { method: string; headers: Record<string, string>; body: string; keepalive?: boolean }) => Promise<{ status: number }>;
  flushIntervalMs?: number;
  flushAt?: number;
  maxPerRequest?: number;
  maxQueue?: number;
  backoffMs?: number;
  now?: () => number;
  scheduleFlush?: (cb: () => void, ms: number) => unknown;
  cancelFlush?: (handle: unknown) => void;
}

export interface Transport {
  enqueue(signal: Signal): void;
  flush(): Promise<void>;
  takeAll(): Signal[];
  queuedCount(): number;
  dispose(): void;
}

export function createTransport(options: TransportOptions): Transport {
  const {
    url,
    fetchFn = (u, init) => fetch(u, init),
    flushIntervalMs = 5000,
    flushAt = 10,
    maxPerRequest = 64,
    maxQueue = 200,
    backoffMs = 30_000,
    now = Date.now,
    scheduleFlush = (cb, ms) => setTimeout(cb, ms),
    cancelFlush = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  } = options;

  let queue: Signal[] = [];
  let timer: unknown = null;
  let backoffUntil = 0;
  let sending = false;

  async function flush(): Promise<void> {
    if (sending || queue.length === 0 || now() < backoffUntil) return;
    sending = true;
    try {
      while (queue.length > 0) {
        const batch = queue.slice(0, maxPerRequest);
        queue = queue.slice(batch.length);
        let status: number;
        try {
          ({ status } = await fetchFn(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ signals: batch }),
          }));
        } catch {
          queue = [...batch, ...queue];   // network error: keep for retry
          return;
        }
        if (status === 429) {
          queue = [...batch, ...queue];
          backoffUntil = now() + backoffMs;
          return;
        }
        if (status < 200 || status >= 300) {
          queue = [...batch, ...queue];
          return;
        }
      }
    } finally {
      sending = false;
    }
  }

  return {
    enqueue(signal) {
      try {
        queue.push(signal);
        if (queue.length > maxQueue) queue = queue.slice(queue.length - maxQueue);
        if (queue.length >= flushAt) {
          void flush();
        } else if (timer === null) {
          timer = scheduleFlush(() => { timer = null; void flush(); }, flushIntervalMs);
        }
      } catch { /* never throw into host */ }
    },
    flush: () => flush().catch(() => undefined),
    takeAll() {
      const drained = queue;
      queue = [];
      return drained;
    },
    queuedCount: () => queue.length,
    dispose() {
      if (timer !== null) { try { cancelFlush(timer); } catch { /* noop */ } timer = null; }
    },
  };
}
