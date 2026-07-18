# Signals — local-first error & event collector

**Date:** 2026-07-18
**Status:** Approved design, awaiting implementation plan
**Owner:** Beka Bendeliani

## What this is

A self-hosted, fully local error/event monitoring subsystem (think Sentry, but ours and tiny) built inside this repo but **independent from the tickets domain**. External apps — React, Node, or plain-HTML browser pages — install an SDK, point it at a DSN, and their errors appear grouped and browsable in a new **Signals** section of the web UI, alongside Tickets, Terminals, and Agents.

Everything is a **signal** (`kind: error | log | event`) from day one, even though v1's UI focuses on errors. Every signal carries a `session_id`, so when apps later send ordinary events, the "full flow that led to the error" view falls out of the existing data model.

## Locked decisions

| Decision | Choice |
| --- | --- |
| Consumers | Any of the user's projects, inside or outside this monorepo |
| Physical shape | Separate app `apps/signals` (own server, port **4630**) + separate database `signals` in the existing postgres container (`127.0.0.1:5532`) |
| Data model | Signal-generic core: one `signals` table + `issues` grouping for errors (Approach B) |
| Grouping | Server-side fingerprinting; events + grouped issues (Sentry model) |
| Registration | DSN-style ingest key per app, created in the UI |
| Capture scope v1 | Core error info + breadcrumbs + custom context API + source maps (all four) |
| Distribution | Publish SDKs to public npm; collector serves an IIFE bundle for plain HTML |
| Name | **Signals** (chosen for future extension to non-error events) |
| Tickets integration | Explicitly deferred — no coupling in v1 |

## Architecture

```
your apps                          this repo
┌──────────────┐  POST /ingest/<key>  ┌─────────────────┐      ┌──────────────┐
│ @signals-sdk/ │ ───────────────────▶│ apps/signals    │─────▶│ postgres      │
│ react/node/   │                     │ (own server,    │      │ database:     │
│ <script sdk>  │                     │  port 4630)     │      │ "signals"     │
└──────────────┘                      └─────────────────┘      └──────────────┘
                                              ▲
                              management API  │
                                      ┌───────┴────────┐
                                      │ apps/web       │  new "Signals" section
                                      └────────────────┘
```

- `apps/signals` is a standalone Fastify-style server modeled on `apps/api` conventions, with **zero imports from ticket modules**. It owns its drizzle schema, config, and migrations.
- **Dev:** joins the `pnpm dev` mprocs lineup on port 4630. Web dev server proxies `/signals-api/*` → `localhost:4630`.
- **Deploy:** a second service in the existing docker-compose. The tickets nginx proxies `/signals-api/*` to the signals container so the web UI needs no CORS and no hardcoded host. The ingest endpoints allow **any origin** (browser SDKs post cross-origin from other sites).

## Data model (4 tables, database `signals`)

- **apps** — `id, name, slug, ingest_key (random secret, rendered as DSN), created_at`
- **signals** — one row per report: `id (bigserial), app_id, kind ('error'|'log'|'event'), session_id (text), name` (error type or event name), `message, level, client_timestamp, received_at, release, environment, issue_id (nullable FK), payload (jsonb)`. Payload holds stack frames (raw + symbolicated), embedded breadcrumbs, user, tags, contexts, platform info, SDK name/version.
- **issues** — `id, app_id, fingerprint, title, status ('open'|'resolved'|'ignored'), first_seen, last_seen, event_count, created_at`; unique on `(app_id, fingerprint)`.
- **sourcemap_artifacts** — `id, app_id, release, filename, content, uploaded_at`. Maps live in the DB (local-first; no file volume to manage).

Sessions are implicit: an ID the SDK generates per page load (browser) or process start (node). No sessions table; the timeline is `WHERE session_id = ?`.

## Ingest pipeline

`POST /ingest/:key` accepts a batch envelope `{ signals: [...] }` (max 64 signals, ~200 KB per signal — oversize payloads truncated server-side). The key resolves to an app; unknown keys → 403. The endpoint validates, writes, and returns 202.

**Fingerprinting (server-side, errors only).** Hash of: error type + normalized message (numbers, UUIDs, hex strings stripped) + top 5 in-app stack frames using **function name + file path only** (line numbers shift between releases). A signal may carry an explicit `fingerprint` field that overrides this. Fingerprinting lives on the server so grouping logic can improve without republishing SDKs.

**Issue lifecycle.** Lookup `(app_id, fingerprint)`:
- missing → create issue (`status=open`, title from error type + message)
- exists → increment `event_count`, update `last_seen`
- `resolved` + new event → **reopen** (regression); `ignored` stays ignored but keeps counting

**Symbolication.** If the signal has a `release` with uploaded source maps, stack frames are resolved at ingest time; both raw and resolved frames are stored in the payload.

**Flood control.** Per-key rate limit (~300 signals/min → 429; SDKs back off). No sampling in v1.

## Management API (consumed by the web UI)

- `GET/POST /apps`, `GET /apps/:id` (DSN + setup snippets data)
- `GET /issues` — filters: app, status, level, time range, text search; includes daily counts for sparklines
- `GET /issues/:id`, `PATCH /issues/:id` (status), `GET /issues/:id/signals` (occurrences, paginated)
- `GET /sessions/:sessionId/signals` — chronological session timeline
- `POST /ingest/:key/sourcemaps` — multipart upload: release + map files
- `GET /sdk.js` — prebuilt browser IIFE bundle (reads `data-dsn` from its script tag)

## SDK packages (`packages/signals/*` in this repo → public npm)

Working scope `@signals-sdk/*`; fallback `@beka-signals/*` if taken at publish time (identical package names otherwise).

**`@signals-sdk/core`** — platform-neutral:
- API: `captureError(err, extra?)`, `captureEvent(name, data?)`, `addBreadcrumb(b)`, `setUser`, `setTag`, `setContext`, `beforeSend` hook (scrub or drop)
- Breadcrumb ring buffer (default 50), embedded into every error report
- Batching transport: flush every ~5 s or 10 signals; retry with backoff; honors 429; client-side rate cap; payload truncation
- Session ID generation
- **Never-throw guarantee:** every public API and transport path is wrapped; an unreachable collector can never affect the host app — worst case signals drop silently

**`@signals-sdk/browser`** — `init({ dsn })` hooks `window.onerror` + `unhandledrejection`. Auto-breadcrumbs: console (log/warn/error), clicks (CSS selector), history/route changes, fetch/XHR (url, method, status, duration). Flush-on-unload via `sendBeacon`. Session = one page load.

**`@signals-sdk/react`** — re-exports browser init; adds `<SignalsErrorBoundary fallback={...}>` (captures component stack) and `useSignals()`. Window-level handlers still catch what boundaries miss.

**`@signals-sdk/node`** — `init({ dsn })` hooks `uncaughtException` + `unhandledRejection`; captures node version, pid, hostname; Express and Fastify error-handler helpers; ships the `signals-upload` CLI: `npx @signals-sdk/node signals-upload --dsn … --release 1.2.0 ./dist`. Session = one process lifetime.

**Plain HTML** — `<script src="http://host:4630/sdk.js" data-dsn="…"></script>` auto-inits the browser SDK; zero build step.

## Web UI — "Signals" section in apps/web

Top-level nav entry beside Tickets / Terminals / Agents. Instrument design system; visual design generated in the claude.ai/design project and pulled via DesignSync. Four screens:

1. **Apps** — registered apps list (name, platform icons, last-24 h signal count); create-app flow ending in DSN + tabbed setup snippets (React / Node / script tag); empty state.
2. **Issues** — dense table: level dot, title, app badge, count, first/last seen, 14-day sparkline, status; toolbar filters (app, status, level, time, search); Resolve/Ignore row actions; regressed-issue marker; empty and flood (4 000+ count) states.
3. **Issue detail** — status actions; symbolicated stack trace (in-app frames emphasized, vendor collapsed, raw fallback state); breadcrumb timeline with per-type icons; context panel (user, tags, platform, custom); paginated occurrences, each linking to its session.
4. **Session timeline** — all signals of one session chronologically with an elapsed-time gutter; the error highlighted as the terminal point. This is the "full flow" view and grows in value as non-error events arrive.

## Testing

- Table-driven unit tests for message normalization + fingerprinting
- Core SDK: batching, retry/backoff, ring buffer, never-throw (transport failures must not propagate)
- Integration: ingest → issue create → repeat groups → resolve → reopen-on-regression; sourcemap upload → symbolicated frames
- UI per project skills (`mapping-component-states`, `verifying-a-component`)
- `examples/` with a minimal vite page and node script as manual smoke targets

## Out of scope (v1)

Ticket creation from issues (future integration — likely an action on an issue that opens a pre-filled ticket), alerting/notifications, retention/cleanup jobs, event sampling, auth on the management UI (local network trust), dedicated UIs for non-error signals beyond the session timeline.

## Types

**Signal envelope (SDK → collector):**

```ts
type SignalKind = 'error' | 'log' | 'event'

interface SignalEnvelope {
  signals: Signal[]
}

interface Signal {
  kind: SignalKind
  sessionId: string
  name: string                  // error type ("TypeError") or event name ("checkout.completed")
  message?: string
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug'
  timestamp: string             // ISO, client clock
  release?: string
  environment?: string          // 'production' | 'development' | free-form
  fingerprint?: string          // explicit grouping override
  stack?: StackFrame[]          // errors only, raw
  breadcrumbs?: Breadcrumb[]    // ring-buffer dump, errors only
  user?: { id?: string; email?: string; name?: string }
  tags?: Record<string, string>
  contexts?: Record<string, Record<string, unknown>>
  platform: PlatformInfo
  sdk: { name: string; version: string }
}

interface StackFrame {
  functionName: string
  file: string
  line: number
  column: number
  inApp: boolean
}

interface Breadcrumb {
  type: 'console' | 'click' | 'navigation' | 'http' | 'custom'
  timestamp: string
  message?: string
  data?: Record<string, unknown>   // e.g. { url, method, status, durationMs } for http
}

interface PlatformInfo {
  runtime: 'browser' | 'node'
  os?: string
  browser?: string              // browser runtime
  url?: string                  // browser runtime
  nodeVersion?: string          // node runtime
  hostname?: string             // node runtime
  pid?: number                  // node runtime
}
```
