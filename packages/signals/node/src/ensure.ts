export interface EnsureAppDsnOptions {
  /** Base URL of the collector. Defaults to the local dev collector. */
  collectorUrl?: string;
  name: string;
  fetchFn?: typeof fetch;
  /** Abort the registration request after this many ms. Defaults to 2000. */
  timeoutMs?: number;
}

/**
 * Self-registers an app with the Signals collector via `POST /apps`
 * (`{ name, upsert: true }`) and resolves the DSN the collector assigned it.
 *
 * Never throws: any non-2xx response, network failure, malformed JSON body,
 * or timeout resolves `null` instead of rejecting. The timeout is enforced
 * independently of the abort signal reaching `fetchFn`, so a stub or a
 * misbehaving fetch implementation that never settles still resolves in
 * `timeoutMs`.
 */
export async function ensureAppDsn(options: EnsureAppDsnOptions): Promise<string | null> {
  const { collectorUrl = 'http://127.0.0.1:4640', name, fetchFn = fetch, timeoutMs = 2000 } = options;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('ensureAppDsn: timed out'));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetchFn(`${collectorUrl}/apps`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, upsert: true }),
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);
    if (response.status !== 200 && response.status !== 201) return null;
    const body = (await response.json()) as { dsn?: unknown };
    return typeof body?.dsn === 'string' ? body.dsn : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer!);
  }
}
