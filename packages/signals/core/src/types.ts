export type SignalKind = 'error' | 'log' | 'event';

export type Mechanism =
  | 'uncaught-exception'   // window.onerror / process uncaughtException
  | 'unhandled-rejection'
  | 'error-boundary'       // React
  | 'middleware'           // Express/Fastify error handler
  | 'console'              // log-kind, from console instrumentation
  | 'manual';              // captureError / captureEvent calls

export interface SignalEnvelope {
  signals: Signal[];
}

export interface StackFrame {
  functionName: string;
  file: string;
  line: number;
  column: number;
  inApp: boolean;
}

export interface Breadcrumb {
  type: 'console' | 'click' | 'navigation' | 'http' | 'custom';
  timestamp: string;
  message?: string;
  data?: Record<string, unknown>;   // e.g. { url, method, status, durationMs } for http
}

export interface PlatformInfo {
  runtime: 'browser' | 'node';
  os?: string;
  browser?: string;              // browser runtime
  url?: string;                  // browser runtime
  nodeVersion?: string;          // node runtime
  hostname?: string;             // node runtime
  pid?: number;                  // node runtime
}

export type SignalLevel = 'error' | 'warning' | 'info';

export interface SdkInfo {
  name: string;
  version: string;
}

export interface Signal {
  kind: SignalKind;
  sessionId: string;
  name: string;
  message?: string;
  mechanism: Mechanism;
  level: SignalLevel;
  timestamp: string;
  release?: string;
  environment?: string;
  fingerprint?: string;
  stack?: StackFrame[];
  breadcrumbs?: Breadcrumb[];
  user?: { id?: string; email?: string; name?: string };
  tags?: Record<string, string>;
  contexts?: Record<string, Record<string, unknown>>;
  platform: PlatformInfo;
  sdk: SdkInfo;
}

export interface CaptureOptions {
  level?: SignalLevel;
  mechanism?: Mechanism;
  fingerprint?: string;
  contexts?: Record<string, Record<string, unknown>>;
}
