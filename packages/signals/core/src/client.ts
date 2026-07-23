import { parseDsn } from './dsn';
import { parseStack } from './stack-parse';
import { createTransport, type Transport } from './transport';
import type { Breadcrumb, CaptureOptions, Mechanism, PlatformInfo, SdkInfo, Signal, SignalLevel } from './types';

export interface ClientOptions {
  dsn: string;
  release?: string;
  environment?: string;
  maxBreadcrumbs?: number;
  beforeSend?: (signal: Signal) => Signal | null;
  platform: PlatformInfo;
  sdk: SdkInfo;
  transport?: Transport;
  sessionId?: string;
  now?: () => Date;
  isInApp?: (file: string) => boolean;
  // opt-in: patch console.warn/error (and log/info, depending on logLevel) to
  // also emit `log` signals. See console-capture.ts / installConsoleCapture.
  captureConsole?: boolean;
  logLevel?: SignalLevel;
}

export interface SignalsClient {
  captureError(error: unknown, options?: CaptureOptions): void;
  captureEvent(name: string, data?: Record<string, unknown>, options?: CaptureOptions): void;
  captureLog(message: string, level?: SignalLevel): void;
  addBreadcrumb(breadcrumb: Breadcrumb): void;
  setUser(user: { id?: string; email?: string; name?: string } | null): void;
  setTag(key: string, value: string): void;
  setContext(key: string, context: Record<string, unknown> | null): void;
  flush(): Promise<void>;
  takeAll(): Signal[];
  sessionId: string;
  // false when the DSN failed to parse and no transport was injected
  enabled: boolean;
}

export function generateSessionId(): string {
  let id = '';
  while (id.length < 10) id += Math.random().toString(36).slice(2);
  return `sess_${id.slice(0, 10)}`;
}

const truncate = (value: string, max: number): string => (value.length > max ? value.slice(0, max) : value);

export function createClient(options: ClientOptions): SignalsClient {
  const {
    maxBreadcrumbs = 50,
    beforeSend,
    platform,
    sdk,
    sessionId = generateSessionId(),
    now = () => new Date(),
    isInApp,
  } = options;

  // clamped once here since these come from ClientOptions and don't change per call
  const release = options.release !== undefined ? truncate(options.release, 100) : undefined;
  const environment = options.environment !== undefined ? truncate(options.environment, 50) : undefined;

  let transport: Transport | null = options.transport ?? null;
  let enabled = true;
  if (!transport) {
    try {
      transport = createTransport({ url: parseDsn(options.dsn).ingestUrl });
    } catch {
      enabled = false;
    }
  }

  const breadcrumbs: Breadcrumb[] = [];
  let user: Signal['user'];
  const tags: Record<string, string> = {};
  const contexts: Record<string, Record<string, unknown>> = {};

  function send(signal: Signal): void {
    if (!enabled || !transport) return;
    let out: Signal | null = signal;
    if (beforeSend) out = beforeSend(signal);   // caller (guarded) catches hook bugs
    if (out) transport.enqueue(out);
  }

  const guarded = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A): void => {
    try { fn(...args); } catch { /* the SDK must never break the host app */ }
  };

  function baseSignal(kind: Signal['kind'], name: string, mechanism: Mechanism, level: SignalLevel, opts?: CaptureOptions): Signal {
    const mergedContexts = { ...contexts, ...opts?.contexts };
    return {
      kind,
      sessionId,
      name,
      mechanism: opts?.mechanism ?? mechanism,
      level: opts?.level ?? level,
      timestamp: now().toISOString(),
      release,
      environment,
      fingerprint: opts?.fingerprint !== undefined ? truncate(opts.fingerprint, 200) : undefined,
      user: user ? { ...user } : undefined,
      tags: Object.keys(tags).length ? { ...tags } : undefined,
      contexts: Object.fromEntries(Object.entries(mergedContexts).map(([k, v]) => [k, { ...v }])),
      platform,
      sdk,
    };
  }

  return {
    sessionId,
    // false when the DSN failed to parse and no transport was injected
    get enabled() { return enabled; },

    captureError: guarded((error: unknown, opts?: CaptureOptions) => {
      const isError = error instanceof Error;
      const rawName = isError ? error.name || 'Error' : 'Error';
      const name = truncate(rawName, 300) || 'Error';
      const signal = baseSignal('error', name, 'manual', 'error', opts);
      signal.message = truncate(isError ? error.message : String(error), 5000);
      signal.stack = parseStack(isError ? error.stack : undefined, isInApp);
      signal.breadcrumbs = breadcrumbs.map((b) => ({ ...b, data: b.data ? { ...b.data } : undefined }));
      send(signal);
    }),

    captureEvent: guarded((name: string, data?: Record<string, unknown>, opts?: CaptureOptions) => {
      const clampedName = truncate(name, 300) || '<unnamed>';
      const signal = baseSignal('event', clampedName, 'manual', 'info', opts);
      if (data) signal.contexts = { ...signal.contexts, event: { ...data } };
      send(signal);
    }),

    captureLog: guarded((message: string, level: SignalLevel = 'info') => {
      const signal = baseSignal('log', 'console', 'console', level);
      signal.message = truncate(message, 5000);
      send(signal);
    }),

    addBreadcrumb: guarded((breadcrumb: Breadcrumb) => {
      breadcrumbs.push({
        ...breadcrumb,
        message: breadcrumb.message ? truncate(breadcrumb.message, 500) : undefined,
        data: breadcrumb.data ? { ...breadcrumb.data } : undefined,
      });
      if (breadcrumbs.length > maxBreadcrumbs) breadcrumbs.splice(0, breadcrumbs.length - maxBreadcrumbs);
    }),

    setUser: guarded((next) => { user = next ? { ...next } : undefined; }),
    setTag: guarded((key: string, value: string) => { tags[key] = truncate(value, 200); }),
    setContext: guarded((key: string, context) => {
      if (context === null) delete contexts[key];
      else contexts[key] = context;
    }),

    flush: () => {
      if (!transport) return Promise.resolve();
      try {
        return transport.flush();
      } catch {
        return Promise.resolve();
      }
    },
    takeAll: () => {
      if (!transport) return [];
      try {
        return transport.takeAll();
      } catch {
        return [];
      }
    },
  };
}
