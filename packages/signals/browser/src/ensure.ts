export interface EnsureAppDsnOptions {
  name: string;
  /** Same-origin path the collector is reverse-proxied under. Defaults to `/signals-api`. */
  basePath?: string;
  /** Host (+ port) to bake into the DSN. Defaults to `${location.hostname}:4640`. */
  ingestHost?: string;
  fetchFn?: typeof fetch;
  /** Abort the registration request after this many ms. Defaults to 2000. */
  timeoutMs?: number;
}

/**
 * Self-registers an app with the Signals collector via a same-origin
 * `POST ${basePath}/apps` (`{ name, upsert: true }`), then builds the DSN
 * itself from the response's `ingestKey` and `id` rather than trusting the
 * collector's own `dsn` field — the collector only knows its loopback
 * address, but a LAN viewer's browser needs to ingest against the host it
 * loaded the page from. That host is `ingestHost`, or `location.hostname`
 * with the collector's default port when not supplied.
 *
 * Never throws: any non-2xx response, network failure, malformed JSON body,
 * or timeout resolves `null` instead of rejecting.
 */
export async function ensureAppDsn(options: EnsureAppDsnOptions): Promise<string | null> {
  const { name, basePath = '/signals-api', ingestHost, fetchFn = fetch, timeoutMs = 2000 } = options;

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
      fetchFn(`${basePath}/apps`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, upsert: true }),
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);
    if (response.status !== 200 && response.status !== 201) return null;
    const body = (await response.json()) as { id?: unknown; ingestKey?: unknown };
    if (typeof body?.ingestKey !== 'string' || (typeof body?.id !== 'number' && typeof body?.id !== 'string')) {
      return null;
    }
    const host = ingestHost ?? `${location.hostname}:4640`;
    return `sgl://${body.ingestKey}@${host}/${body.id}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer!);
  }
}
