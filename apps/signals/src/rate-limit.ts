export interface RateLimiter {
  allow(key: string, weight?: number): boolean;
}

// Fixed-window counter per ingest key. In-memory is fine: single-process
// collector, and 429 is advisory back-pressure, not a security boundary.
export function createRateLimiter({
  limit = 300,
  windowMs = 60_000,
  now = Date.now,
}: { limit?: number; windowMs?: number; now?: () => number } = {}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    allow(key, weight = 1) {
      const t = now();
      const w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        windows.set(key, { start: t, count: weight });
        return weight <= limit;
      }
      w.count += weight;
      return w.count <= limit;
    },
  };
}
