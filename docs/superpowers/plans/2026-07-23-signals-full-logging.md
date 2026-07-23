# Signals Full Logging Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every app (api/web/mcp/eer/signals) emits not just errors but **logs** and **events**, and the web UI gains an **Activity** view to browse the non-error kinds.

**Architecture:** The pipeline already exists — SDKs export `captureLog`/`captureEvent`/`addBreadcrumb`, the collector ingest schema accepts `kind: error|log|event`. This plan adds (1) an opt-in `captureConsole` SDK flag, (2) a collector signals-listing endpoint for logs/events, (3) collector self-monitoring, (4) per-app instrumentation of lifecycle/audit events, and (5) a web Activity view + toolbar.

**Spec:** `docs/superpowers/specs/2026-07-23-signals-full-logging-design.md`

## Global Constraints

- **Never-throw guarantee is absolute.** Every new capture call degrades to a single `console.warn` and never affects app behavior. A down collector must never slow or break any app — including the collector self-monitoring itself (no recursion on self-report failure).
- **Log gate:** default capture `warn`+ only. `SIGNALS_LOG_LEVEL` (node) / `VITE_SIGNALS_LOG_LEVEL` (vite) env overrides the floor. `info` is breadcrumb-only unless captured explicitly.
- **High-frequency = breadcrumb, not event.** Navigation, per-request, per-keystroke never become standalone `event` signals.
- **No domain audit as events** — item-activity owns ticket/item mutations. Signals events are infra/lifecycle only.
- **eer stays dev-only** — do not add it to the container in this plan.
- Existing suites stay green; new behavior gets tests. Branch `feat/signals-full-logging` off main; conventional commits scoped by app, one per task, pathspec-scoped (never touch untracked `communication.md`/`ideas.md`).
- Slugs unchanged: `tickets-api|web|mcp|eer`; new `signals-collector`.

---

### Task 1: SDK — `captureConsole` init flag (core + node + browser)

**Files:** Modify `packages/signals/core/src/client.ts`, `packages/signals/core/src/types.ts` (InitOptions gains `captureConsole?: boolean`); create `packages/signals/core/src/console-capture.ts`; wire into `packages/signals/node/src/index.ts` + `packages/signals/browser/src/index.ts` init paths. Tests: `packages/signals/core/src/console-capture.test.ts`.

**Interfaces:**
- Produces: `installConsoleCapture(client, floor: SignalLevel): () => void` — patches `console.warn`/`console.error` to also `captureLog(msg, level)` at/above `floor`, returns an uninstall fn. Preserves original console behavior (call through). Idempotent (double-install is a no-op).
- `initSignals({ captureConsole?: boolean, logLevel?: SignalLevel })` — when `captureConsole` is true, install after client construction.

- [ ] Write failing test: with a fake client, `installConsoleCapture(client,'warning')` → `console.warn('x')` calls `client.captureLog('x','warning')` once AND the original console.warn still fires; `console.log('x')` (info) does NOT capture; uninstall fn restores original.
- [ ] Run it, verify fail.
- [ ] Implement `console-capture.ts` + thread the flag through init in all three packages.
- [ ] Run tests + `pnpm --filter './packages/signals/*' build` + typecheck. Commit `feat(signals-sdk): opt-in captureConsole for warn+ console logs`.

### Task 2: Collector — signals-listing endpoint for logs/events

**Files:** Create `apps/signals/src/routes/signals.routes.ts` (`GET /signals`); register in the app; test `apps/signals/src/routes/signals.routes.test.ts`.

**Interfaces:**
- `GET /signals?kind=log,event&app=<id>&level=<lvl>&days=<n>&q=<text>&page=<n>&perPage=<n>` → `{ rows: SignalListRow[]; total: number }` where `SignalListRow = { id, appId, appSlug, kind, name, message, level, mechanism, sessionId, clientTimestamp, receivedAt }`. Defaults: `kind=log,event` (errors excluded — they live under /issues), `perPage=50`, ordered `received_at desc`. `q` matches name/message ILIKE.
- Consumes: existing drizzle `signals` table + `apps` join for slug.

- [ ] Failing tests: seed 3 log + 2 event + 1 error signal → `GET /signals` returns the 5 non-error rows, newest first; `?kind=event` returns 2; `?app=` filters; `?q=` matches message; pagination `total` correct.
- [ ] Implement the route + query (mirror issues.routes.ts filter-building).
- [ ] Gate: `pnpm --filter @tickets/signals test` + typecheck. Commit `feat(signals): GET /signals listing for logs & events`.

### Task 3: Collector — self-monitoring

**Files:** Create `apps/signals/src/signals-self.ts` (in-process init); modify `apps/signals/src/server.ts` (init at boot, capture boot/shutdown events), ingest write path + symbolicate call sites + migration runner to capture failures. Test `apps/signals/src/signals-self.test.ts`.

**Interfaces:**
- `initSelfSignals(): SignalsClient | null` — registers app `signals-collector` in its own DB (direct insert, idempotent on slug) and returns a node SDK client pointed at `http://127.0.0.1:<own port>`; null when `SIGNALS_SELF_DISABLED=1`. Never throws.
- Capture sites: ingest DB-write catch → `captureError(err,{contexts:{ingest}})`; symbolicate catch → `captureError(err,{level:'warning'})`; migration catch → `captureError`; boot → `captureEvent('collector.boot')`; prune run → `captureEvent('collector.prune',{deleted})`; sourcemap upload → `captureEvent('collector.sourcemap-upload',{release})`.

- [ ] Failing test: injected fake self-client → a forced ingest write failure calls `captureError` once; boot calls `captureEvent('collector.boot')`; `SIGNALS_SELF_DISABLED=1` → init returns null and nothing captures.
- [ ] Implement; ensure a self-report failure cannot recurse (guard: the self-client's own transport errors are swallowed, not re-captured).
- [ ] Gate: signals suite + typecheck. Commit `feat(signals): self-monitor collector (errors + lifecycle events)`.

### Task 4: apps/api — logs + lifecycle/audit events

**Files:** Modify `apps/api/src/signals.ts` (enable `captureConsole`, pass `logLevel` from env), `apps/api/src/server.ts` (boot/shutdown events), `apps/api/src/agent/driver.ts` + `apps/api/src/terminal/driver.ts` (session start/end + run completed events), `apps/api/src/outbox/worker.ts` (batch-flushed event). Test: append to `apps/api/src/signals.test.ts` + a driver-level event test.

**Interfaces:** use top-level `captureEvent`/`captureLog` from `@bendela6/signals-node`. Events: `api.boot`, `api.shutdown`, `agent.run.started|completed|failed` (`{sessionId}`), `terminal.session.started|ended` (`{sessionId}`), `outbox.flush` (`{count}`). Console-capture on via `captureConsole:true`.

- [ ] Failing test: a fake client injected into the agent driver → a successful run emits `agent.run.completed` once with `sessionId`; a failed run emits `agent.run.failed` (in addition to the existing error capture, not instead of it).
- [ ] Implement all sites; keep every call fire-and-forget/never-throw.
- [ ] Gate: full api suite + typecheck. Commit `feat(api): emit lifecycle/audit events + warn+ console logs to Signals`.

### Task 5: apps/mcp — tool-call audit events + logs

**Files:** Modify `apps/mcp/src/signals.ts` (or init site — enable `captureConsole`), `apps/mcp/src/helpers/run-tool.ts` (emit a per-call event), `apps/mcp/src/server.ts` (start/stop events). Test: `apps/mcp` has no runner — typecheck only + a manual note.

**Interfaces:** in `runTool(name, work)`, on success emit `captureEvent('mcp.tool', { name, ok:true, durationMs })`; the existing failure path additionally emits `captureEvent('mcp.tool', { name, ok:false, durationMs })` alongside its `captureError`. Events: `mcp.boot`, `mcp.shutdown`.

- [ ] Implement (mirror the existing runTool capture wrapper); measure duration around `work()`.
- [ ] Gate: `pnpm --filter @tickets/mcp typecheck` (or root typecheck). Commit `feat(mcp): tool-call audit events + console logs to Signals`. NOTE in the commit body: not runtime-verified (stdio subprocess, no test runner).

### Task 6: apps/web + apps/eer — console logs + lifecycle events

**Files:** Modify `apps/web/src/signals-init.ts` (enable `captureConsole`, `app.mount` event), optional web-vitals hook; `apps/eer/src/signals-init.ts` (same + `eer.model.import|export` events at the round-trip call site in `apps/eer/src/api/models-client.ts`). Tests: append to `apps/web/src/signals-init.test.ts`.

**Interfaces:** `captureEvent('web.mount')` once after init; eer `captureEvent('eer.model.import',{modelName})` / `('eer.model.export',{modelName})`. Console-capture on. Web-vitals optional/behind a flag — skip if it pulls a dependency; note as deferred if so.

- [ ] Failing test: web signals-init with stubbed client → `captureConsole` installed and `web.mount` emitted once; disabled flag → neither.
- [ ] Implement web + eer.
- [ ] Gate: web suite + typecheck; eer typecheck. Commit `feat(web,eer): console logs + lifecycle events to Signals`.

### Task 7: Web — Activity view (logs + events stream)

**Files:** Create `apps/web/src/api/signals/signals-api.ts` additions (`listSignals(filters)` + types), `apps/web/src/api/signals/use-signals.ts` (`useSignalsActivity`), `apps/web/src/components/signals/activity-screen.tsx`, `apps/web/src/components/signals/activity-row.tsx`, `apps/web/src/components/signals/activity-toolbar.tsx`; route wiring in the signals section; tab/nav entry. Tests: `apps/web/src/components/signals/activity-screen.test.tsx`.

**Interfaces:**
- `listSignals(filters: { kind?: 'log'|'event'; app?: number; level?: IssueLevel; days?: number; q?: string; page?: number; perPage?: number }): Promise<{ rows: SignalListRow[]; total: number }>` → `GET /signals-api/signals?…`.
- `ActivityScreen` — toolbar (App / Kind log|event / Level / time-range / search) + a flat row list (kind glyph, name/message, app chip, level dot, relative time, session link) + loading/error/empty states, mirroring IssuesScreen structure.

- [ ] Failing test: render ActivityScreen with mocked rows → shows log + event rows with kind glyphs; kind filter switches the query param; empty state renders when zero rows.
- [ ] Implement api fn + hook + screen + row + toolbar + route + nav entry.
- [ ] Gate: `pnpm --filter @tickets/web test` + typecheck. Commit `feat(web): Signals Activity view for logs & events`.

### Task 8: Gate + live end-to-end proof + docs + container rebuild

- [ ] Suites: signals, api, web, SDK packages; `pnpm typecheck`; `pnpm build`.
- [ ] Live dev proof (collector + dev api up): trigger an agent run → confirm `agent.run.completed` event via `curl :4640/signals?kind=event`; emit a `console.warn` in a dev route → confirm a `log` row; confirm `signals-collector` app self-registered (`curl :4640/apps`).
- [ ] Rebuild container (`docker compose up -d --build app`); confirm `api.boot` event + `signals-collector` app appear after boot.
- [ ] Update `docs/signals-capture-guide.md` (add logs/events scenarios) + `docs/signals-sdk.md` (`captureConsole`, `SIGNALS_LOG_LEVEL` knobs). Commit `docs(signals): logs & events capture guide + env knobs`.

## Self-review notes

- Coverage: every app in the matrix has a task (api=4, mcp=5, web+eer=6, signals=3, collector-endpoint=2, SDK flag=1, UI=7). Errors already shipped — this plan is purely the log/event/self-monitor delta.
- Failure isolation: Tasks 3–6 all route through the never-throw SDK; Task 3 explicitly guards against self-report recursion.
- Not done here (deliberate): grouping/dedup for logs/events, traces/metrics, alerting, domain-audit mirroring, eer container deployment, web-vitals if it needs a new dep (deferred with a note).
- Type consistency: `SignalListRow` defined identically in Task 2 (server) and Task 7 (client); `captureConsole`/`logLevel` init options defined in Task 1 and consumed in 4/5/6.
