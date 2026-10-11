import type { ResolverCache } from './resolver-cache';

export class AsyncConfigTimeoutError extends Error {
  override readonly name = 'AsyncConfigTimeoutError';
  constructor() {
    super('Async config did not resolve within the submission timeout');
  }
}

/**
 * Waits for in-flight async resolvers to settle, but only those whose cache
 * key starts with a visible field's name. Times out after `timeoutMs` and
 * rejects with `AsyncConfigTimeoutError`.
 *
 * Cache keys are formatted `${fieldName}.${configKey}::${depsKey(...)}` by
 * `use-resolved-config.ts`. We split on the first `.` to recover the field
 * name and skip entries belonging to fields the user no longer sees — a
 * long-running fetch in a hidden branch must not delay submission.
 */
export async function waitForResolutions(
  cache: ResolverCache,
  visibleFieldNames: ReadonlySet<string>,
  timeoutMs = 30_000,
): Promise<void> {
  const pending: Promise<unknown>[] = [];
  for (const [key, entry] of cache.entries()) {
    if (entry.status !== 'pending') {
      continue;
    }
    const dot = key.indexOf('.');
    const fieldName = dot >= 0 ? key.slice(0, dot) : key;
    if (!visibleFieldNames.has(fieldName)) {
      continue;
    }
    pending.push(entry.promise);
  }
  if (pending.length === 0) {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((_, reject) => {
    timer = setTimeout(() => reject(new AsyncConfigTimeoutError()), timeoutMs);
  });
  try {
    await Promise.race([Promise.allSettled(pending).then(() => undefined), timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
