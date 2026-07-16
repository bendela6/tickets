// In-process nudge: a committed command wakes the running worker so the common
// path drains immediately. A no-op in tests and any process without a worker.
let listener: (() => void) | null = null;

export function onOutboxNotify(fn: () => void): void {
  listener = fn;
}
export function clearOutboxNotify(): void {
  listener = null;
}
export function notifyOutbox(): void {
  listener?.();
}
