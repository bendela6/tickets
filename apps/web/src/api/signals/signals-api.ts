import { fetchJson } from '../client';

// ---- shared enums --------------------------------------------------------

export type IssueStatus = 'open' | 'resolved' | 'ignored';
export type IssueLevel = 'error' | 'warning' | 'info';

// ---- apps -----------------------------------------------------------------

export interface SignalsAppRow {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
  signals24h: number;
  errors24h: number;
}

// Response from creating an app (includes the one-time-visible ingest secrets).
export interface SignalsAppDetail {
  id: number;
  name: string;
  slug: string;
  ingestKey: string;
  dsn: string;
  createdAt: string;
}

// ---- issues -----------------------------------------------------------------

export interface IssueRow {
  id: number;
  key: string;
  title: string;
  culprit: string | null;
  appId: number;
  appSlug: string;
  status: IssueStatus;
  level: IssueLevel;
  mechanism: string | null;
  eventCount: number;
  firstSeen: string;
  lastSeen: string;
  spark: number[];
}

export interface IssueDetail extends IssueRow {
  sessionCount: number;
  userCount: number;
  releaseRange: { first: string | null; last: string | null };
}

export interface IssueFilters {
  app?: number;
  status?: IssueStatus;
  level?: IssueLevel;
  days?: number;
  q?: string;
  page?: number;
  perPage?: number;
}

// Fixed key order — the wire query string must be stable regardless of the
// order keys were set on the filters object.
const ISSUE_FILTER_KEY_ORDER: (keyof IssueFilters)[] = ['app', 'status', 'level', 'days', 'q', 'page', 'perPage'];

function buildIssuesQuery(filters: IssueFilters): string {
  const params = new URLSearchParams();
  for (const key of ISSUE_FILTER_KEY_ORDER) {
    const value = filters[key];
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs.length > 0 ? `?${qs}` : '';
}

// ---- occurrences -----------------------------------------------------------

export interface OccurrenceRow {
  id: number;
  receivedAt: string;
  release: string | null;
  sessionId: string | null;
}

export interface OccurrencePage {
  rows: OccurrenceRow[];
  total: number;
}

// ---- sessions ---------------------------------------------------------------

// Loosely typed — screens consume this, we just describe the shape enough to
// route it around safely without pinning down every SDK's exact payload.
export interface SignalStackFrame {
  functionName: string;
  file: string;
  line: number;
  column: number;
  inApp: boolean;
  contextLines?: { line: number; text: string }[];
}

export interface SignalBreadcrumb {
  type: string;
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

export interface SignalPayload {
  stack?: SignalStackFrame[];
  stackSymbolicated?: SignalStackFrame[];
  breadcrumbs?: SignalBreadcrumb[];
  user?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  platform?: PlatformInfo;
  sdk?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SessionInfo {
  sessionId: string;
  appId: number;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  crashed: boolean;
  counts: { error: number; log: number; event: number };
  release: string | null;
  platform: PlatformInfo | null;
}

export interface SessionEventRow {
  id: number;
  kind: string;
  name: string | null;
  message: string | null;
  mechanism: string | null;
  level: IssueLevel | null;
  clientTimestamp: string;
  issueId: number | null;
  issueKey: string | null;
  payload: SignalPayload;
}

export interface SessionTimeline {
  session: SessionInfo;
  rows: SessionEventRow[];
}

// ---- meta ---------------------------------------------------------------

export interface SignalsMeta {
  dbSizeBytes: number;
}

// ---- fetchers -----------------------------------------------------------

export function listIssues(filters: IssueFilters = {}): Promise<{ rows: IssueRow[]; total: number }> {
  return fetchJson(`/signals-api/issues${buildIssuesQuery(filters)}`);
}

export function getIssue(id: number): Promise<IssueDetail> {
  return fetchJson(`/signals-api/issues/${id}`);
}

export function patchIssueStatus(id: number, status: IssueStatus): Promise<IssueRow> {
  return fetchJson(`/signals-api/issues/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function listOccurrences(id: number, page = 1, perPage = 25): Promise<OccurrencePage> {
  const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  return fetchJson(`/signals-api/issues/${id}/signals?${params.toString()}`);
}

export function getSession(sessionId: string, appId?: number): Promise<SessionTimeline> {
  const qs = appId !== undefined ? `?app=${appId}` : '';
  return fetchJson(`/signals-api/sessions/${sessionId}/signals${qs}`);
}

export function listApps(): Promise<SignalsAppRow[]> {
  return fetchJson('/signals-api/apps');
}

export function createApp(name: string): Promise<SignalsAppDetail> {
  return fetchJson('/signals-api/apps', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function getMeta(): Promise<SignalsMeta> {
  return fetchJson('/signals-api/meta');
}
