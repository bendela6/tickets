# Signals Self-Monitoring (dogfood) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every app in this monorepo reports its own errors into Signals — apps/api and apps/mcp via the node SDK, apps/web via the react SDK, apps/eer via the browser SDK — with zero manual registration: each app ensures its own collector registration at boot.

**Architecture:** The collector's `POST /apps` gains opt-in upsert semantics (existing slug → 200 with the existing app + DSN instead of 409). The SDKs gain a tiny `ensureAppDsn` helper (node: absolute collector URL; browser: same-origin `/signals-api` + host-rewritten DSN so LAN viewers ingest to the right host). Apps consume the SDK packages as `workspace:^` deps (no publish needed) and init at boot behind a `SIGNALS_DISABLED` / `VITE_SIGNALS_DISABLED` opt-out. Everything preserves the SDK's never-throw guarantee: a down collector logs one line and the app runs normally.

**Slugs:** `tickets-api`, `tickets-web`, `tickets-mcp`, `tickets-eer`. Environments: `development` (dev) / `production` (container).

## Global Constraints

- The SDK never-throw guarantee extends to bootstrap: `ensureAppDsn` returns `null` on any failure (timeout 2s, non-2xx, network) — callers skip init and log a single console.warn. App startup must NEVER fail or slow >2s because Signals is down.
- `SIGNALS_DSN` (node) / `VITE_SIGNALS_DSN` (vite apps) env override skips ensure entirely; `SIGNALS_DISABLED=1` / `VITE_SIGNALS_DISABLED=1` skips init entirely.
- Collector URL for node apps: `SIGNALS_COLLECTOR_URL` default `http://127.0.0.1:4640` (correct in dev AND inside the container — same netns).
- apps/signals itself is NOT instrumented (self-reporting feedback loop) — explicitly out of scope.
- Existing test suites stay green; new behavior gets tests (collector upsert; ensure helpers; api error-hook wiring via injected fake client).
- Branch: `feat/signals-self-monitoring` off main. Commits `feat(signals|api|web|mcp|eer): …`, one per task, pathspec-scoped.

---

### Task 1: Collector — idempotent app registration (upsert)

**Files:** Modify `apps/signals/src/routes/apps.routes.ts`; test append `apps/signals/src/routes/apps.routes.test.ts`.

**Interfaces:** `POST /apps` body gains optional `upsert?: boolean`. When true and the slugified name already exists → **200** with the existing row `{ ...app, dsn }` (ingestKey unchanged). When false/absent → existing 409 behavior unchanged. Valibot: `v.optional(v.boolean())`.

- [ ] Failing tests (append): (a) create with `{name:'Tickets API', upsert:true}` twice → second call 200, same `id` and `ingestKey` as the first; (b) plain duplicate without upsert still 409.
- [ ] Implement (in the existing duplicate-check branch: if `parsed.output.upsert` → `reply.status(200).send({ ...existingFullRow, dsn: composeDsn(...) })` — fetch the full row, not just id).
- [ ] Gate: `pnpm --filter @tickets/signals test` + typecheck. Commit `feat(signals): idempotent app registration via upsert`.

### Task 2: SDK ensure helpers

**Files:** Create `packages/signals/node/src/ensure.ts` (+ export from index); create `packages/signals/browser/src/ensure.ts` (+ export from index); tests colocated.

**Interfaces:**
- node: `ensureAppDsn(options: { collectorUrl?: string; name: string; fetchFn?: typeof fetch; timeoutMs?: number }): Promise<string | null>` — POST `${collectorUrl ?? 'http://127.0.0.1:4640'}/apps` with `{ name, upsert: true }`, AbortController timeout (default 2000ms), returns `body.dsn` on 200/201, null otherwise (never throws).
- browser: `ensureAppDsn(options: { name: string; basePath?: string; ingestHost?: string; fetchFn?: typeof fetch; timeoutMs?: number }): Promise<string | null>` — POST `${basePath ?? '/signals-api'}/apps` (same-origin), then REWRITES the DSN host: from the response's `ingestKey` + `id`, build `sgl://${ingestKey}@${ingestHost ?? `${location.hostname}:4640`}/${id}` — so a LAN viewer's browser ingests to the server it loaded the page from, not the server's loopback. Null on any failure.

- [ ] Failing tests: node — resolves dsn from a stubbed 200; null on 500 / on fetch throw / on timeout (fake fetch that never resolves + short timeoutMs; assert it settles to null); browser (jsdom) — posts to `/signals-api/apps`, builds the host-rewritten `sgl://` DSN from ingestKey/id/location.hostname, null on failure.
- [ ] Implement both; build + test + typecheck the two packages. Commit `feat(signals-sdk): ensureAppDsn self-registration helpers`.

### Task 3: apps/api + apps/mcp wiring (node)

**Files:** Modify `apps/api/package.json` (dep `"@bendela6/signals-node": "workspace:^"`), `apps/api/src/server.ts`, `apps/api/src/app.ts`, `apps/api/src/environment.ts` (signals knobs); create `apps/api/src/signals.ts` (init helper); same pattern for `apps/mcp` (read its entry first — wire at server start). Test: `apps/api/src/signals.test.ts` + append an app.ts-level test.

**Interfaces:**
- `apps/api/src/signals.ts`: `initApiSignals(): Promise<SignalsClient | null>` — returns null when `SIGNALS_DISABLED=1`; uses `SIGNALS_DSN` else `await ensureAppDsn({ collectorUrl, name: 'Tickets API' })`; on null DSN → console.warn once, return null; else `initSignals({ dsn, environment: NODE_ENV ?? 'development', exitOnUncaught: NODE_ENV === 'production', registerProcessHandlers: true })`.
- `buildApp(context)` gains optional `signals?: SignalsClient | null`; the existing `setErrorHandler`'s non-HttpError branch additionally calls `context.signals?.captureError(error, { mechanism: 'middleware', contexts: { http: { method: request.method, url: request.url } } })` (or the SDK's `fastifyErrorHook(client)` — implementer's choice, same contract). HttpError 4xxs are NOT captured (expected client errors).
- `server.ts`: init before buildApp, pass into context; on shutdown `await signals?.flush()` before exit.
- apps/mcp: same init at entry (name 'Tickets MCP', slug tickets-mcp); no request-hook (process handlers only).

- [ ] Failing test: buildApp with an injected fake SignalsClient → a route that throws (use an existing failing path or register a throwing test route via `app.get` before inject) → fake captured once with mechanism middleware + http context; an HttpError 404 path → NOT captured.
- [ ] Implement; `pnpm install`; full api suite + typecheck green (existing tests pass unchanged since `signals` is optional/undefined). Commit `feat(api,mcp): self-report errors to Signals at boot`.

### Task 4: apps/web + apps/eer wiring (browser/react)

**Files:** Modify `apps/web/package.json` (dep `"@bendela6/signals-react": "workspace:^"`), `apps/web/src/main.tsx` (init + `<SignalsErrorBoundary>` around the root, minimal centered fallback with a reload button), create `apps/web/src/signals-init.ts`; `apps/eer`: vite config gains the `/signals-api` proxy (same shape as apps/web's), package.json dep `"@bendela6/signals-browser": "workspace:^"`, init in its entry (name 'Tickets EER'). Tests: `apps/web/src/signals-init.test.ts`.

**Interfaces:** `initWebSignals(): Promise<void>` — skip when `import.meta.env.VITE_SIGNALS_DISABLED === '1'`; DSN from `VITE_SIGNALS_DSN` else browser `ensureAppDsn({ name: 'Tickets Web' })`; init `initSignals({ dsn, environment: import.meta.env.MODE })`; fire-and-forget from main.tsx (`void initWebSignals()`) — rendering must not wait.

- [ ] Failing test: signals-init with stubbed fetch → initSignals called with the rewritten DSN (spy via module mock or exported seam); disabled flag → no fetch.
- [ ] Implement both apps; web suite + typecheck green; eer typecheck green. Commit `feat(web,eer): self-report errors to Signals`.

### Task 5: Gate + live end-to-end proof + container rebuild

- [ ] Suites: web, api, signals, SDK packages; `pnpm typecheck`.
- [ ] Live dev proof: with the dev collector running, start the dev api; hit a route that errors (e.g. `curl :4600/api/items/999999999` or a known-throwing path — find one); then `curl :4640/issues?q=` and confirm a `tickets-api` issue exists. For web: load :4620, confirm `tickets-web` app row appeared in `/signals-api/apps` (registration proof).
- [ ] Rebuild the container (`docker compose up -d --build app`) and confirm `tickets-api` self-registers inside it (`curl :4640/apps` shows tickets-api after container boot).
- [ ] Update `docs/signals-sdk.md` with a short "self-monitoring in this repo" note + the env knobs. Commit `docs(signals): self-monitoring notes` (with any doc edits from earlier tasks).

## Self-review notes

- Failure isolation: every init path degrades to "no signals" with one warn; timeouts bound boot cost; apps/signals excluded by design.
- Slug stability: names 'Tickets API/Web/MCP/EER' slugify to tickets-api/web/mcp/eer deterministically.
- Not done here (deliberate): SIGNALS_PUBLIC_ADDRESS reconciliation (browser helper's host-rewrite sidesteps it for these apps); sourcemap upload for web release builds (follow-up).
