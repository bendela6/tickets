import type { Breadcrumb, SignalLevel, SignalsClient } from '@bendela6/signals-core';

export type CaptureConsoleMode = 'breadcrumbs' | 'both' | 'off';

export interface InstrumentOptions {
  captureConsole: CaptureConsoleMode;
  ingestUrl: string | null;
}

type Teardown = () => void;

function addBreadcrumb(client: SignalsClient, breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
  client.addBreadcrumb({ ...breadcrumb, timestamp: new Date().toISOString() });
}

function installErrorListener(client: SignalsClient): Teardown {
  const handler = (event: ErrorEvent) => {
    client.captureError(event.error ?? event.message, { mechanism: 'uncaught-exception' });
  };
  window.addEventListener('error', handler);
  return () => window.removeEventListener('error', handler);
}

function installUnhandledRejectionListener(client: SignalsClient): Teardown {
  const handler = (event: Event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    client.captureError(reason, { mechanism: 'unhandled-rejection' });
  };
  window.addEventListener('unhandledrejection', handler);
  return () => window.removeEventListener('unhandledrejection', handler);
}

const CONSOLE_LEVEL_MAP: Record<'log' | 'warn' | 'error', SignalLevel> = {
  log: 'info',
  warn: 'warning',
  error: 'error',
};

function installConsolePatch(client: SignalsClient, mode: CaptureConsoleMode): Teardown {
  if (mode === 'off') return () => {};

  const methods: Array<'log' | 'warn' | 'error'> = ['log', 'warn', 'error'];
  const originals: Record<string, (...args: unknown[]) => void> = {};

  const wrapped: Record<string, (...args: unknown[]) => void> = {};

  for (const method of methods) {
    originals[method] = console[method].bind(console);
    wrapped[method] = (...args: unknown[]) => {
      originals[method]!(...args);
      try {
        const message = args.map((a) => (typeof a === 'string' ? a : safeStringify(a))).join(' ');
        addBreadcrumb(client, { type: 'console', message, data: { method } });
        if (mode === 'both') {
          client.captureLog(message, CONSOLE_LEVEL_MAP[method]);
        }
      } catch {
        addBreadcrumb(client, { type: 'console', message: '<unserializable>', data: { method } });
      }
    };
    console[method] = wrapped[method]!;
  }

  return () => {
    for (const method of methods) {
      // defensive: only restore if nothing else re-patched console[method] after us
      if (console[method] === wrapped[method]) console[method] = originals[method]!;
    }
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function cssSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const classes = Array.from(el.classList).slice(0, 2).map((c) => `.${c}`).join('');
  return `${tag}${id}${classes}`;
}

function installClickListener(client: SignalsClient): Teardown {
  const handler = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    addBreadcrumb(client, { type: 'click', message: cssSelector(target) });
  };
  document.addEventListener('click', handler, { capture: true });
  return () => document.removeEventListener('click', handler, { capture: true });
}

function installHistoryInstrumentation(client: SignalsClient): Teardown {
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  const onNavigate = () => {
    addBreadcrumb(client, { type: 'navigation', message: location.pathname + location.search });
  };

  const patchedPushState = function patchedPushState(this: History, ...args: Parameters<typeof history.pushState>) {
    const result = originalPushState.apply(this, args);
    onNavigate();
    return result;
  };
  const patchedReplaceState = function patchedReplaceState(this: History, ...args: Parameters<typeof history.replaceState>) {
    const result = originalReplaceState.apply(this, args);
    onNavigate();
    return result;
  };
  history.pushState = patchedPushState;
  history.replaceState = patchedReplaceState;

  const popstateHandler = () => onNavigate();
  window.addEventListener('popstate', popstateHandler);

  return () => {
    // defensive: only restore if nothing else re-patched history after us
    if (history.pushState === patchedPushState) history.pushState = originalPushState;
    if (history.replaceState === patchedReplaceState) history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', popstateHandler);
  };
}

function installFetchInstrumentation(client: SignalsClient): Teardown {
  const originalFetch = window.fetch.bind(window);

  const describeRequest = (input: unknown, init: unknown): { method: string; url: string } => {
    let method = 'GET';
    let url = 'unknown';
    try {
      const initMethod = (init as { method?: unknown } | undefined)?.method;
      if (typeof initMethod === 'string') method = initMethod.toUpperCase();
      else if (input instanceof Request && typeof input.method === 'string') method = input.method.toUpperCase();
    } catch {
      // fall back to 'GET' above
    }
    try {
      url = input instanceof Request ? input.url : String(input);
    } catch {
      // fall back to 'unknown' above
    }
    return { method, url };
  };

  const wrappedFetch = async (...args: Parameters<typeof fetch>) => {
    const start = Date.now();
    try {
      // raw args passed through untouched — the user's fetch call must never be altered
      // or blocked by breadcrumb-computation failures.
      const response = await originalFetch(...args);
      try {
        const { method, url } = describeRequest(args[0], args[1]);
        // The SDK's own transport ingests through this same (patched) fetch —
        // without this guard every ingest POST would breadcrumb itself, and
        // that breadcrumb would ride the *next* batch, forever.
        if (!url.includes('/ingest/')) {
          addBreadcrumb(client, {
            type: 'http',
            message: `${method} ${url}`,
            data: { status: response.status, durationMs: Date.now() - start },
          });
        }
      } catch {
        // never let breadcrumb bookkeeping affect the fetch result
      }
      return response;
    } catch (error) {
      try {
        const { method, url } = describeRequest(args[0], args[1]);
        if (!url.includes('/ingest/')) {
          addBreadcrumb(client, {
            type: 'http',
            message: `${method} ${url}`,
            data: { error: true, durationMs: Date.now() - start },
          });
        }
      } catch {
        // never let breadcrumb bookkeeping affect the rethrow below
      }
      throw error;
    }
  };

  window.fetch = wrappedFetch as typeof fetch;

  return () => {
    // defensive: only restore if nothing else re-patched fetch after us
    if (window.fetch === wrappedFetch) window.fetch = originalFetch;
  };
}

function installFlushOnHide(client: SignalsClient, ingestUrl: string | null): Teardown {
  const flush = () => {
    try {
      if (!ingestUrl) return;
      if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
      const signals = client.takeAll();
      if (signals.length === 0) return;
      navigator.sendBeacon(ingestUrl, JSON.stringify({ signals }));
    } catch {
      // best-effort flush on page hide — must never throw during unload
    }
  };

  const visibilityHandler = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', visibilityHandler);
  window.addEventListener('pagehide', flush);

  return () => {
    document.removeEventListener('visibilitychange', visibilityHandler);
    window.removeEventListener('pagehide', flush);
  };
}

export function installInstrumentation(client: SignalsClient, options: InstrumentOptions): Teardown {
  const teardowns: Teardown[] = [];

  const install = (installer: () => Teardown): void => {
    try {
      const teardown = installer();
      teardowns.push(teardown);
    } catch {
      // skip this hook, but keep the others — one bad installer must never
      // take down the rest of the instrumentation.
    }
  };

  install(() => installErrorListener(client));
  install(() => installUnhandledRejectionListener(client));
  install(() => installConsolePatch(client, options.captureConsole));
  install(() => installClickListener(client));
  install(() => installHistoryInstrumentation(client));
  install(() => installFetchInstrumentation(client));
  install(() => installFlushOnHide(client, options.ingestUrl));

  return () => teardowns.forEach((fn) => {
    try {
      fn();
    } catch {
      // best-effort teardown — never throw during re-init/uninstall
    }
  });
}
