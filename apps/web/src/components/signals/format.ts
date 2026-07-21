// Formatting helpers for the Signals UI (docs/design/SigGallery.dc.html).
// Counts must never be abbreviated ("a flood must read as a flood, not
// '4.2k'"), timestamps use the design's compact relative style, and byte /
// duration formatting matches what issue detail + session pages need.

/** Grouped-thousands count, e.g. 4213 -> "4,213". Never abbreviated. */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Compact relative time ("2m", "41m", "3h", "12d") matching the design's
 * timestamp style. `now` is injectable for deterministic tests.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60_000));

  if (diffMin < 60) {
    return `${diffMin}m`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr}h`;
  }
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/** Human-readable byte size, e.g. 2_252_000_000 -> "2.1 GB". */
export function formatBytes(n: number): string {
  if (n === 0) {
    return '0 B';
  }
  const exponent = Math.min(
    BYTE_UNITS.length - 1,
    Math.floor(Math.log(Math.abs(n)) / Math.log(1024)),
  );
  const value = n / 1024 ** exponent;
  const formatted = exponent === 0 ? String(value) : value.toFixed(1).replace(/\.0$/, '');
  return `${formatted} ${BYTE_UNITS[exponent]}`;
}

/** Human-readable duration, e.g. 86_000 -> "1m 26s". */
export function formatDurationMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
