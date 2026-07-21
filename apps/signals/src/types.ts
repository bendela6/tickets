export type SignalKind = 'error' | 'log' | 'event';
export type SignalLevel = 'error' | 'warning' | 'info';
export type Mechanism =
  | 'uncaught-exception'
  | 'unhandled-rejection'
  | 'error-boundary'
  | 'middleware'
  | 'console'
  | 'manual';
export type IssueStatus = 'open' | 'resolved' | 'ignored';

export interface StackFrame {
  functionName: string;
  file: string;
  line: number;
  column: number;
  inApp: boolean;
}

export interface SymbolicatedFrame extends StackFrame {
  // ±2 lines of original source around `line`, when the map carries sourcesContent
  contextLines?: { line: number; text: string }[];
}

export interface Breadcrumb {
  type: 'console' | 'click' | 'navigation' | 'http' | 'custom';
  timestamp: string;
  message?: string;
  data?: Record<string, unknown>;
}

export interface PlatformInfo {
  runtime: 'browser' | 'node';
  os?: string;
  browser?: string;
  url?: string;
  nodeVersion?: string;
  hostname?: string;
  pid?: number;
}

// What lands in signals.payload (jsonb)
export interface SignalPayload {
  stack?: StackFrame[];
  stackSymbolicated?: SymbolicatedFrame[];
  breadcrumbs?: Breadcrumb[];
  user?: { id?: string; email?: string; name?: string };
  tags?: Record<string, string>;
  contexts?: Record<string, Record<string, unknown>>;
  platform: PlatformInfo;
  sdk: { name: string; version: string };
  truncated?: boolean;
}
