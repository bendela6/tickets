# Signals — full logging coverage (errors + logs + events, all 5 apps)

**Date:** 2026-07-23
**Status:** Design — ready to plan
**Owner:** Beka Bendeliani
**Builds on:** `docs/superpowers/specs/2026-07-18-signals-error-collector-design.md` (collector, SDKs, web UI — all implemented & merged)

## What this is

The Signals subsystem already logs **errors** across api/web/mcp/eer. This design extends
coverage to the two signal kinds the data model has always supported but no app emits yet —
**logs** and **events** — and closes two gaps: the collector (`apps/signals`) self-monitors
nothing, and eer only reports in dev.

The key realization: **the pipeline is complete.** The SDKs already export `captureLog`,
`captureEvent`, and `addBreadcrumb` (`packages/signals/{node,browser}/src/index.ts`), and the
collector's ingest schema already accepts `kind: error | log | event`
(`apps/signals/src/routes/ingest.schema.ts:19`). This is instrumentation of call sites + a
display surface for the non-error kinds — not new infrastructure.

## The signal taxonomy

| Kind | Meaning | Becomes | Groups? |
| --- | --- | --- | --- |
| `error` | A fault — exception, unhandled rejection, failure-as-data, 5xx | an **Issue** (resolvable/ignorable/reopenable) | by fingerprint |
| `log` | A captured log line worth keeping (warn/error console, structured server warnings) | a **Log** entry | no (v1) |
| `event` | A domain / lifecycle / audit fact (boot, deploy, session start/end, job/agent/tool done) | an **Event** in an activity stream | no |
| `message` | A deliberate `captureMessage("…")` note that isn't an exception | stored as a Log | no |

Out of scope for v1 (future): traces / performance transactions, metrics.

**Cross-cutting** (already carried on every signal): `level` (error|warning|info),
`mechanism`, `session_id`, `release`, `environment`, `platform`, `user`, `tags`, `contexts`,
and **breadcrumbs**.

## Locked decisions

| Decision | Choice |
| --- | --- |
| Log gate | Capture `warn`+ only by default; `info` logs are breadcrumb-only unless explicitly captured. Env-tunable via `SIGNALS_LOG_LEVEL`. |
| Console auto-capture | SDK gains an opt-in `captureConsole` init flag: `console.warn`/`console.error` → `log` signals (in addition to the existing breadcrumb behavior). Off by default; each app opts in. |
| High-frequency events | Navigation / per-request / per-keystroke stay **breadcrumbs**, never standalone events. Only lifecycle + audit facts become events. |
| Domain audit | **Not** captured as Signals events — the tickets domain's own `item-activity` already records ticket/item mutations. Signals events are infra/lifecycle only. |
| Collector self-monitoring | **Yes.** `apps/signals` registers itself as app `signals-collector` and reports its own errors/events. Safe: the SDK never-throw guarantee means a failed self-report logs one line and never recurses. |
| eer deployment | **Keep dev-only.** eer stays out of the container; its signals report only under `pnpm dev`. Documented, not a bug. |
| Grouping for logs/events | None in v1 — logs and events are a flat, filterable stream. Only errors group into issues. |

## Per-app capture matrix

### apps/api — Tickets API (node SDK) · deployed
- **Errors** *(built)*: uncaught/unhandled; Fastify 500 → error, 4xx HttpError → warning (route-pattern fingerprint), 404-unmatched → warning; agent-driver failure-as-data; terminal-driver mid-session/nonzero-exit; outbox/channel-flush/budget-interrupt/boot-reconcile/workdir-fs.
- **Logs (new)**: `console.warn`/`console.error` via `captureConsole`; structured server warnings (slow query, retry, degraded-mode) via explicit `captureLog`.
- **Events (new)**: api boot/ready, graceful shutdown; agent run started/completed/failed; terminal session started/ended; outbox batch flushed; migration applied. Carry `session_id` where relevant.

### apps/web — Tickets Web (react SDK) · deployed
- **Errors** *(built)*: error-boundary; `window.onerror`/unhandledrejection; fetch ≥500 + network (4xx server-owned).
- **Logs (new)**: `console.warn`/`console.error` via `captureConsole`.
- **Events (new)**: app mount; optional sampled web-vitals (LCP/CLS). Navigation stays a breadcrumb.
- **Breadcrumbs** *(built, auto)*: navigation, clicks, fetch, console.

### apps/mcp — Tickets MCP (node SDK) · deployed
- **Errors** *(built)*: process handlers; every `runTool` failure (`contexts.mcpTool.name`).
- **Logs (new)**: console warn/error via `captureConsole`.
- **Events (new)**: server start/stop; each tool call → event (name, duration, ok/failed) — an MCP-usage audit trail, currently invisible.

### apps/eer — Tickets EER (react SDK) · dev-only, NOT deployed
- **Errors** *(built)*: error-boundary; models-client network/5xx.
- **Logs/Events (new)**: console warn/error; model import/export round-trip completed → event.

### apps/signals — Collector (currently logs NOTHING)
- **Errors (new)**: ingest failures (DB write, malformed-beyond-validation) → error; symbolication failures → warning; migration/DB errors → error.
- **Events (new)**: boot; retention/prune runs; sourcemap upload received; rate-limit tripped → warning/event.
- **Safety**: self-reports into `signals-collector`; never-throw = no feedback loop.

## Display surface (web UI)

- **Issues view** — unchanged: errors only, resolvable.
- **Activity view (new)** — a filterable flat stream of `log` + `event` signals across apps:
  filter by app / kind (log|event) / level / time-range / search, mirroring the Issues toolbar.
  Reuses the collector's signal-listing query, filtered to non-error kinds.
- **Session timeline** — already renders mixed kinds; once apps emit logs/events, the typed
  rows the design frames show (`SigSession.dc.html`) populate naturally.

## Server-side additions

- **`GET /signals`** listing endpoint (or extend the existing signals query) filtered by
  `kind in (log,event)`, `app`, `level`, `days`, `q`, paged — feeds the Activity view.
- Collector self-registration on boot (reuse `ensureAppDsn` pattern, but node-internal:
  the collector talks to itself over loopback / in-process).

## Non-goals (v1)

- No grouping/dedup for logs or events.
- No traces, spans, metrics, or performance monitoring.
- No domain-audit mirroring (item-activity stays the source of truth).
- No alerting/notification on logs/events.

## Types

```ts
// Already exists — packages/signals/core, re-exported by node + browser SDKs:
type SignalLevel = 'error' | 'warning' | 'info';
function captureError(error: unknown, options?: CaptureOptions): void;
function captureEvent(name: string, data?: Record<string, unknown>, options?: CaptureOptions): void;
function captureLog(message: string, level?: SignalLevel): void;
function addBreadcrumb(breadcrumb: Breadcrumb): void;

interface CaptureOptions {
  level?: SignalLevel;
  mechanism?: 'uncaught-exception' | 'unhandled-rejection' | 'error-boundary' | 'middleware' | 'console' | 'manual';
  fingerprint?: string;
  contexts?: Record<string, Record<string, unknown>>;
}

// New — SDK init flag:
interface InitOptions {
  // …existing…
  captureConsole?: boolean; // default false — when true, console.warn/error → log signals
}
```
