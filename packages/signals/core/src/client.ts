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
    return {
      kind,
      sessionId,
      name,
      mechanism: opts?.mechanism ?? mechanism,
      level: opts?.level ?? level,
      timestamp: now().toISOString(),
      release: options.release,
      environment: options.environment,
      fingerprint: opts?.fingerprint,
      user,
      tags: Object.keys(tags).length ? { ...tags } : undefined,
      contexts: { ...contexts, ...opts?.contexts },
      platform,
      sdk,
    };
  }

  return {
    sessionId,
    get enabled() { return enabled; },

    captureError: guarded((error: unknown, opts?: CaptureOptions) => {
      const isError = error instanceof Error;
      const signal = baseSignal('error', isError ? error.name || 'Error' : 'Error', 'manual', 'error', opts);
      signal.message = truncate(isError ? error.message : String(error), 5000);
      signal.stack = parseStack(isError ? error.stack : undefined, isInApp);
      signal.breadcrumbs = breadcrumbs.map((b) => ({ ...b }));
      send(signal);
    }),

    captureEvent: guarded((name: string, data?: Record<string, unknown>, opts?: CaptureOptions) => {
      const signal = baseSignal('event', truncate(name, 300), 'manual', 'info', opts);
      if (data) signal.contexts = { ...signal.contexts, event: data };
      send(signal);
    }),

    captureLog: guarded((message: string, level: SignalLevel = 'info') => {
      const signal = baseSignal('log', 'console', 'console', level);
      signal.message = truncate(message, 5000);
      send(signal);
    }),

    addBreadcrumb: guarded((breadcrumb: Breadcrumb) => {
      breadcrumbs.push({ ...breadcrumb, message: breadcrumb.message ? truncate(breadcrumb.message, 500) : undefined });
      if (breadcrumbs.length > maxBreadcrumbs) breadcrumbs.splice(0, breadcrumbs.length - maxBreadcrumbs);
    }),

    setUser: guarded((next) => { user = next ?? undefined; }),
    setTag: guarded((key: string, value: string) => { tags[key] = truncate(value, 200); }),
    setContext: guarded((key: string, context) => {
      if (context === null) delete contexts[key];
      else contexts[key] = context;
    }),

    flush: () => (transport ? transport.flush() : Promise.resolve()),
    takeAll: () => (transport ? transport.takeAll() : []),
  };
}
