# Signals Web UI (apps/web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Signals" top-level section to apps/web — Issues, Apps, Issue detail, and Session timeline screens per the imported design — wired to the live collector via a `/signals-api` proxy, plus full docker/nginx deploy wiring for the collector.

**Architecture:** Follow apps/web conventions exactly: code-based TanStack Router (`src/router.ts` + one `*-route.tsx` per route), `AppShell` + `ActivityRail`/`ModePanel` nav (closed `Mode` union gains `'signals'`), one `use-*.ts` TanStack Query hook per endpoint over a thin typed fetch module with the `/signals-api` prefix, hand-composed screens from `src/ui/` primitives + `cn()` + Instrument tokens (no generic Table/Tabs components exist — compose like `board/table-view.tsx` does), colocated vitest+testing-library tests, manual loading states (`if (!data) return null` idiom), dark mode via `[data-theme]` tokens automatically.

**Visual spec of record:** `docs/design/11-signals.html` + `docs/design/SigGallery.dc.html`, `SigApps.dc.html`, `SigIssues.dc.html`, `SigIssueDetail.dc.html`, `SigSession.dc.html`. Every screen task MUST read its frame before coding: layout, copy, states, and the six new primitives come from there. Design token vars map to Instrument semantic tokens already in `apps/web/src/styles/instrument.css` — match by role (danger/warn/ok/accent/surface/border/muted), mirroring how existing screens use utilities; never hardcode hex.

**Tech Stack:** React 19, TanStack Router/Query, Tailwind v4 tokens, vitest+jsdom+testing-library.

This is **Plan 3 of 3**. Collector (Plan 1) + SDKs (Plan 2) are DONE on this branch; collector runs on :4640.

## Global Constraints

- All new web code under `apps/web/src`; relative imports only (no path aliases); Prettier per `.prettierrc.json`.
- API base prefix for this section: **`/signals-api`** (literal string in the fetch module, like `/api` is elsewhere). Dev: vite proxy → `http://127.0.0.1:4640` (env override `SIGNALS_PROXY_TARGET`). Prod: nginx `location /signals-api/`.
- Routes: `/signals` (Issues, the default tab), `/signals/apps`, `/signals/issues/$issueId`, `/signals/sessions/$sessionId`. Nav mode key `'signals'`, glyph `∿`, label `Signals`.
- Wire shapes come from the collector (all verified live): issues list rows `{ id, key, title, culprit, appId, appSlug, status, level, mechanism, eventCount, firstSeen, lastSeen, spark: number[14] }` with `{ rows, total }`; issue detail adds `{ sessionCount, userCount, releaseRange: { first, last }, spark, appSlug, level, mechanism }`; occurrences `{ rows: { id, receivedAt, release, sessionId }[], total }`; session `{ session: { sessionId, appId, startedAt, endedAt, durationMs, crashed, counts: { error, log, event }, release, platform }, rows: [{ id, kind, name, message, mechanism, level, clientTimestamp, issueId, issueKey, payload }] }`; apps `{ id, name, slug, createdAt, signals24h, errors24h }[]`; app create 201 `{ id, name, slug, ingestKey, dsn, createdAt }`; meta `{ dbSizeBytes }`.
- Counts render grouped-thousands, never abbreviated (`4,213`, not `4.2k`). Level dots and status chips are shape-coded per SigGallery (state must read without color).
- Test gate per task: `pnpm --filter @tickets/web test` + `pnpm --filter @tickets/web typecheck` (if no such script, `pnpm typecheck` covers it — check package.json). Final task adds the monorepo gate + deploy build.
- Commits: `feat(web): signals — …` (deploy task: `feat(deploy): …`), one per task, pathspec-scoped (unrelated work may be staged elsewhere; inside this worktree plain scoped adds are fine but keep the pathspec habit).
- In screen tests, mock the network by stubbing `globalThis.fetch` (`vi.stubGlobal('fetch', …)`) returning canned JSON per URL; wrap rendered components in a fresh `QueryClientProvider` + router context helper (Task 4 builds `renderSignalsRoute` test util; later tasks reuse it).

---

### Task 1: Vite proxy + typed signals API module + query hooks

**Files:**
- Modify: `apps/web/vite.config.ts` (add proxy key)
- Create: `apps/web/src/api/signals/signals-api.ts` (types + fetchers)
- Create: `apps/web/src/api/signals/use-signals.ts` (all query/mutation hooks)
- Test: `apps/web/src/api/signals/signals-api.test.ts`

**Interfaces:**
- Produces (from `signals-api.ts`): TS interfaces `SignalsAppRow`, `SignalsAppDetail`, `IssueRow`, `IssueDetail`, `OccurrencePage`, `SessionTimeline`, `SignalsMeta`, `IssueFilters { app?: number; status?: 'open'|'resolved'|'ignored'; level?: 'error'|'warning'|'info'; days?: number; q?: string; page?: number; perPage?: number }` matching the Global Constraints wire shapes; functions `listIssues(filters): Promise<{rows: IssueRow[]; total: number}>`, `getIssue(id)`, `patchIssueStatus(id, status)`, `listOccurrences(id, page, perPage)`, `getSession(sessionId, appId?)`, `listApps()`, `createApp(name)`, `getMeta()` — each a `fetchJson` call (reuse `apps/web/src/api/client.ts`'s `fetchJson`) against `/signals-api/...`, with `listIssues` building a query string that omits undefined filters.
- Produces (from `use-signals.ts`): `useSignalsIssues(filters)` (queryKey `['signals','issues',filters]`, refetchInterval 10000), `useSignalsIssue(id)`, `useSignalsOccurrences(id, page)`, `useSignalsSession(sessionId)`, `useSignalsApps()` (refetchInterval 30000), `useSignalsMeta()`, `useCreateSignalsApp()` (mutation, invalidates `['signals','apps']`), `usePatchIssueStatus()` (mutation, invalidates `['signals','issues']` and `['signals','issue', id]`).
- Vite proxy addition: `'/signals-api': { target: process.env.SIGNALS_PROXY_TARGET ?? 'http://127.0.0.1:4640', rewrite: (path) => path.replace(/^\/signals-api/, '') }` — NOTE the rewrite: the collector's routes are unprefixed (`/issues`, not `/signals-api/issues`).

- [ ] **Step 1: Failing tests** — `signals-api.test.ts`: stub `globalThis.fetch` capturing URLs and returning `{ ok: true, json: async () => ({ rows: [], total: 0 }) }`-style responses; assert (a) `listIssues({ status: 'open', q: 'boom', days: 14 })` fetches `/signals-api/issues?status=open&days=14&q=boom` (undefined filters omitted, key order stable by construction), (b) `patchIssueStatus(3,'resolved')` sends PATCH with JSON body `{status:'resolved'}`, (c) `createApp('X')` POSTs `{name:'X'}` to `/signals-api/apps`, (d) `getSession('s1')` hits `/signals-api/sessions/s1/signals`.
- [ ] **Step 2: Implement** the module + hooks per the interface block (hooks are thin `useQuery`/`useMutation` wrappers; follow `use-board.ts` / `use-patch-item.ts` patterns).
- [ ] **Step 3: Add the vite proxy.** Verify live if the collector is up: `curl http://127.0.0.1:4620/signals-api/health` → `{"ok":true}` when `pnpm --filter @tickets/web dev` runs (optional smoke; the unit gate is the tests).
- [ ] **Step 4: Gate + commit** — `git commit -m "feat(web): signals — api module, query hooks, dev proxy" -- apps/web`

---

### Task 2: Nav integration — mode, rail item, panel

**Files:**
- Modify: `apps/web/src/components/shell/mode-for-path.ts` (union + prefix match `/signals`)
- Modify: `apps/web/src/components/shell/activity-rail.tsx` (ITEMS entry `{ mode: 'signals', to: '/signals', glyph: '∿', label: 'Signals' }`)
- Modify: `apps/web/src/components/shell/mode-panel.tsx` (case renders `<SignalsPanel/>`)
- Create: `apps/web/src/components/shell/signals-panel.tsx`
- Test: append to `apps/web/src/components/shell/mode-for-path.test.ts`; create `signals-panel.test.tsx`

**Interfaces:**
- `SignalsPanel` mirrors `terminals-panel.tsx`'s structure: section title "Signals", nav links to Issues (`/signals`) and Apps (`/signals/apps`) with active styles, and an open-issues count sourced from `useSignalsIssues({ status: 'open', perPage: 1 })`'s `total` (render nothing while loading — the panel must not flicker).
- `modeForPath('/signals/issues/3')` → `'signals'` (prefix match like the others).

- [ ] **Step 1: Failing tests** — append `mode-for-path` cases (`/signals`, `/signals/apps`, `/signals/sessions/x`); `signals-panel.test.tsx` renders the panel inside QueryClientProvider + router test harness with stubbed fetch returning `{rows:[],total:6}` and asserts the links and the "6" count appear.
- [ ] **Step 2: Implement** all four files (read `terminals-panel.tsx` first and mirror its markup/classes; the rail change is one array entry).
- [ ] **Step 3: Gate + commit** — `feat(web): signals — nav mode, rail entry, section panel`

---

### Task 3: Signals primitives (from SigGallery)

**Files:**
- Create: `apps/web/src/components/signals/level-dot.tsx`, `status-chip.tsx`, `kind-glyph.tsx`, `sparkline.tsx`, `dsn-field.tsx`, `format.ts`
- Test: colocated `*.test.tsx` per component + `format.test.ts`

**Interfaces (visuals per `docs/design/SigGallery.dc.html` — read it first):**
- `LevelDot({ level })` — error: filled danger circle; warning: warn diamond (rotated square); info: open accent circle. Shape-coded; `aria-label={level}`.
- `StatusChip({ status, regressed? })` — open (half-filled accent circle glyph), resolved (filled ok circle + ✓), ignored (dashed muted circle); when `regressed`, an adjacent `↺ regressed` warn chip (never replaces the status chip).
- `KindGlyph({ type })` for `'event'|'log'|'click'|'navigation'|'http'|'error'|'custom'` — the design's glyph set (◆ ≡ ◉ → ⇅ ✕), error variant in danger colors.
- `Sparkline({ counts, hot? })` — 14 bars, heights normalized to the max (min visible height for zero), last bar in danger when `hot`; pure divs, fixed height ~18px.
- `DsnField({ dsn })` — mono text, ellipsis, Copy button using `navigator.clipboard.writeText` with a brief "Copied" state; `aria-label="DSN"`.
- `format.ts`: `formatCount(n)` (grouped thousands, never abbreviated), `relativeTime(iso)` (`2m`, `41m`, `3h`, `12d` — design's compact style), `formatBytes(n)` (`2.1 GB`), `formatDurationMs(ms)` (`1m 26s`).

- [ ] **Step 1: Failing tests** — behavior-focused (per the repo's verifying-a-component ethos): LevelDot renders distinct shapes per level (assert aria-label + a shape-distinguishing style/class attribute differs across levels); StatusChip shows the regressed chip only when `regressed`; Sparkline renders 14 bars and marks the last hot; DsnField copies the dsn (stub `navigator.clipboard`) and flips to "Copied"; `formatCount(4213)==='4,213'`; `relativeTime` table (2min→'2m', 3h, 12d); `formatBytes(2_252_000_000)` → `'2.1 GB'`; `formatDurationMs(86_000)` → `'1m 26s'`.
- [ ] **Step 2: Implement** against the gallery frame; reuse `cn()`; token-backed utility classes only.
- [ ] **Step 3: Gate + commit** — `feat(web): signals — level/status/kind/sparkline/dsn primitives`

---

### Task 4: Issues screen + route scaffolding (the workhorse)

**Files:**
- Create: `apps/web/src/routes/signals-route.tsx` (path `/signals`, renders `<AppShell><IssuesScreen/></AppShell>`)
- Modify: `apps/web/src/router.ts` (import + add to children — also pre-register the three other routes as they land in Tasks 5-7; this task adds only `/signals`)
- Create: `apps/web/src/components/signals/issues-screen.tsx` (+ small subcomponents in the same folder if a file would exceed ~250 lines: `issues-toolbar.tsx`, `issue-row.tsx`)
- Create: `apps/web/src/components/signals/test-utils.tsx` — `renderSignals(ui, { fetchRoutes })`: fresh QueryClient (retry false), memory router if needed, `vi.stubGlobal('fetch', router-table stub)`; exported for Tasks 5-7.
- Test: `issues-screen.test.tsx`

**Screen spec (read `docs/design/SigIssues.dc.html` first — variants list/loading/error/empty are all in it):**
- Header: `Signals` title + meta line (`N open issues · M events last 14d` from the loaded page), tab row Issues (active) / Apps (link to `/signals/apps`).
- Toolbar: app filter (select from `useSignalsApps`), status segmented control (Open/Resolved/Ignored with counts — counts require one extra `perPage:1` query per status; acceptable), level select, days select (7/14/30/90 → `days` filter), search input (debounced 300ms → `q`).
- Table: columns level dot · issue (title split `name — message`, bold name; second line `key · culprit` mono muted) · app badge · events (formatCount; flood suffix when spark last bar dominates is OPTIONAL — skip the ▲/min live rate, it needs an endpoint we don't have) · first/last seen (relativeTime) · 14-day `Sparkline` (hot when status open and last bar > 0) · `StatusChip` (+regressed OPTIONAL — the API has no regressed flag; OMIT the chip usage here and note it) · hover row actions ✓ Resolve / ⊘ Ignore calling `usePatchIssueStatus`.
- Row click → navigate `/signals/issues/$issueId`. Resolved/ignored rows dimmed (~60% opacity).
- States: loading = 8 skeleton rows keeping the column grid (pulse animation); error = centered "Couldn't load issues" + the failing URL + Retry button (refetch) — copy per the design's error frame; empty = "No open issues 🎉" + links that switch the status filter.
- Footer: `{total} issues` + simple pagination `‹ page ›` when total > perPage (25).

- [ ] **Step 1: Failing tests** — with `renderSignals` + canned fetch: (a) renders rows from a 2-row issues payload (names, `SGL-` keys, formatted counts, appSlug badges visible); (b) clicking Resolve issues a PATCH to `/signals-api/issues/1` and refetches (assert second GET); (c) error stub (fetch rejects) → "Couldn't load issues" + Retry visible; (d) empty payload → "No open issues" copy; (e) typing in search updates the request URL with `q=` after debounce (vi.useFakeTimers).
- [ ] **Step 2: Implement** screen + route + router registration.
- [ ] **Step 3: Gate + commit** — `feat(web): signals — issues screen with filters, sparklines, status actions`

---

### Task 5: Apps screen + new-app flow

**Files:**
- Create: `apps/web/src/routes/signals-apps-route.tsx` (path `/signals/apps`)
- Modify: `apps/web/src/router.ts`
- Create: `apps/web/src/components/signals/apps-screen.tsx`, `new-app-dialog.tsx`
- Test: `apps-screen.test.tsx`

**Screen spec (read `docs/design/SigApps.dc.html` — variants list/new/empty):**
- Same header/tab row (Apps active). `＋ New app` primary button.
- Table: app (initials avatar + mono slug) · Signals·24h (formatCount) · Errors·24h (danger when >0, `—` when 0) · created date. Row count footer line: `N apps · sending to {origin}/signals-api` + right side `{formatBytes(dbSizeBytes)} on disk` from `useSignalsMeta` (no retention copy — retention doesn't exist).
- New-app flow: dialog (reuse `src/ui/dialog.tsx`) with name input → on create success swaps to the success panel: `✓ {slug} is ready`, `DsnField` with the returned dsn, snippet tabs React / Node / `<script>` (static `<pre>` blocks with the real `@bendela6/signals-*` install+init code, dsn interpolated; script tab uses `<script src="http://<host>:4640/sdk.js" data-dsn="…">`). No "waiting for first signal" spinner (needs polling we skip in v1) — copy adjusted to "Send your first signal and it will appear under Issues."
- Empty state: "Connect your first app" + the three-step cards + New app button, per the design.

- [ ] **Step 1: Failing tests** — (a) renders app rows with 24h counts and the db-size footer; (b) empty list shows "Connect your first app"; (c) New app → type name → submit POSTs `/signals-api/apps`, success panel shows the DSN from the mocked 201 and the three snippet tabs switch content (click Node tab → `@bendela6/signals-node` text visible).
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Gate + commit** — `feat(web): signals — apps screen with DSN + snippet onboarding`

---

### Task 6: Issue detail screen

**Files:**
- Create: `apps/web/src/routes/signals-issue-route.tsx` (path `/signals/issues/$issueId`)
- Modify: `apps/web/src/router.ts`
- Create: `apps/web/src/components/signals/issue-detail-screen.tsx` (+ `stack-trace.tsx`, `breadcrumb-list.tsx`, `context-rail.tsx` subcomponents)
- Test: `issue-detail-screen.test.tsx`

**Screen spec (read `docs/design/SigIssueDetail.dc.html` — variants sym/raw):**
- Breadcrumb line `‹ Issues / SGL-142` (link back). Header: LevelDot + `name` mono bold + message; StatusChip + app badge + `key · culprit` line; actions ✓ Resolve / ⊘ Ignore (usePatchIssueStatus).
- Stats bar: EVENTS (formatCount, emphasized) · SESSIONS (sessionCount) · FIRST SEEN (relativeTime + first release) · LAST SEEN (+ last release) · RELEASES (`first → last`) · right-aligned Sparkline.
- Stack trace card: sym/raw toggle. Data source: the NEWEST occurrence's payload — fetch `useSignalsOccurrences(id, 1)` then `useSignalsSession` is wrong; instead add ONE new fetcher in this task: `getIssueLatestSignal` is NOT an endpoint — use `listOccurrences(id,1,1)` to get the newest signal id + sessionId, then reuse `getSession(sessionId)` and pick the row whose `issueId` matches and id equals — acceptable v1 wiring (2 requests). Frames: `payload.stackSymbolicated` when present (sym tab; in-app frames emphasized with file:line accent, non-in-app collapsed into `N framework frames` expandable groups; top in-app frame auto-expanded showing `contextLines` with the error line highlighted), else raw tab only with the design's "No source maps uploaded for release X" warn banner + the upload command in a mono block.
- Breadcrumbs card: from the same payload's `breadcrumbs` — KindGlyph + type label + message (+ http status chip ok/danger + duration when `data.status`/`durationMs`) + time (HH:MM:SS from timestamp); terminal red row = the error itself; `full session →` link to `/signals/sessions/$sessionId`.
- Context rail: USER (id/email + `userCount` line "hit by N users"), TAGS (release/environment + payload.tags), PLATFORM (runtime/browser chips), CONTEXT · X cards per `payload.contexts` key (skip `event`).
- Occurrences card: paginated table (time · release · session link `sess_… →`) via `useSignalsOccurrences`; session links navigate to the timeline route.
- States: loading null-render; 404 → "Issue not found" + back link.

- [ ] **Step 1: Failing tests** — canned issue + occurrences + session payloads (session row carries stackSymbolicated with one in-app frame + contextLines, breadcrumbs incl. an http 500 crumb): (a) header shows name/status/culprit and stats (sessionCount, releaseRange); (b) sym tab shows the original file path + context line text; raw toggle shows raw frames; (c) a payload WITHOUT stackSymbolicated shows the no-sourcemaps banner and only the raw view; (d) breadcrumbs render glyph types and the 500 chip; (e) occurrences render and the session link points at `/signals/sessions/sess_x`; (f) Resolve PATCHes.
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Gate + commit** — `feat(web): signals — issue detail with symbolicated stack, breadcrumbs, occurrences`

---

### Task 7: Session timeline screen

**Files:**
- Create: `apps/web/src/routes/signals-session-route.tsx` (path `/signals/sessions/$sessionId`)
- Modify: `apps/web/src/router.ts`
- Create: `apps/web/src/components/signals/session-screen.tsx`
- Test: `session-screen.test.tsx`

**Screen spec (read `docs/design/SigSession.dc.html`):**
- Breadcrumb `‹ Issues / {issueKey} / session` when arrived with an error (derive from the timeline's first error row's issueKey; plain `‹ Issues` otherwise). Header: mono sessionId + app badge + user chip (from first row payload.user) + `crashed` danger chip when `session.crashed`; Copy-session-id button.
- Stats bar: STARTED (absolute time) · DURATION (formatDurationMs) · SIGNALS (`{total} · {counts.log} logs · {counts.event} events · {counts.error} error`) · RELEASE · BROWSER/platform.
- Timeline: vertical line + elapsed-time gutter (`t+0.0s` from `clientTimestamp - startedAt`); rows: KindGlyph + kind label + message (mono for logs/http, sans for events) ; gaps > 30s compressed to a dashed `{n}s idle` pill; error rows render the danger card (name + message + `View issue {issueKey} →` button linking `/signals/issues/$issueId` + culprit line from payload).
- 404 (unknown session) → "Session not found" + back link.

- [ ] **Step 1: Failing tests** — canned timeline (event, log, 35s gap, error with issueKey): (a) rows in order with elapsed gutter values; (b) the idle pill appears for the gap; (c) the error card links to the issue route; (d) crashed chip + duration in header; (e) 404 payload → "Session not found".
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Gate + commit** — `feat(web): signals — session timeline (full flow view)`

---

### Task 8: Deploy wiring — collector in the app container

**Files:**
- Modify: `Dockerfile` (deps stage: copy `apps/signals/package.json` + `packages/signals/*/package.json` before install; new build steps: build the four SDK packages — the browser dist is needed for `/sdk.js` — and include `apps/signals` source in the final stage)
- Modify: `docker/nginx.conf` (add `location /signals-api/ { proxy_pass http://127.0.0.1:4640/; … same proxy headers as /api/ … }` — NOTE trailing slash on proxy_pass strips the prefix, matching the vite rewrite)
- Modify: `docker/supervisord.conf` (add `[program:signals]` running `sh -c "pnpm --filter @tickets/signals db:create && pnpm --filter @tickets/signals db:migrate && pnpm --filter @tickets/signals start"`)
- Modify: `docker-compose.yml` (app service env: `SIGNALS_HOST: 0.0.0.0`, `SIGNALS_PORT: 4640`, `SIGNALS_DATABASE: signals`; publish `'4640:4640'` so external apps can send signals + fetch /sdk.js directly)
- Modify: `.claude/skills/running-the-stack/SKILL.md` (deployed URLs: signals API at `:4610/signals-api`, direct ingest at `:4640`)

- [ ] **Step 1: Make the edits** (read each file first; mirror the existing /api location block and [program:api] shape exactly).
- [ ] **Step 2: Verify with a real build**: `docker compose build app` (this is the gate — it must succeed; if docker isn't available in the environment, report BLOCKED rather than skipping). Then `docker compose up -d` and smoke: `curl http://127.0.0.1:4610/signals-api/health` → ok; `curl http://127.0.0.1:4640/health` → ok; `curl http://127.0.0.1:4640/sdk.js | head -c 100` → IIFE. Then `docker compose stop app` if the user's dev flow shouldn't keep it (leave postgres running — dev DBs live there!).
- [ ] **Step 3: Commit** — `feat(deploy): signals collector in app container — nginx /signals-api, supervisord, compose env` (pathspec: Dockerfile docker docker-compose.yml .claude/skills/running-the-stack)

---

### Task 9: Full gate + live end-to-end smoke

- [ ] **Step 1: Gates** — `pnpm --filter @tickets/web test` (all green incl. the 6 new test files), `pnpm typecheck` (monorepo), `pnpm --filter @tickets/web build` (production build must succeed), collector + SDK suites still green (`pnpm --filter @tickets/signals test`, `pnpm --filter './packages/signals/*' test`).
- [ ] **Step 2: Live smoke** — with the collector on :4640 (start if needed) and `pnpm --filter @tickets/web dev` on :4620: `curl -s http://127.0.0.1:4620/signals-api/issues` returns the seeded issues JSON through the proxy; fetch `http://127.0.0.1:4620/` and confirm 200 HTML. Report the outputs.
- [ ] **Step 3: Update the plan/spec status lines** — mark the spec's Status field `Implemented (plans 1-3) — pending merge + publish`; append any deviations to the plan's own notes section.
- [ ] **Step 4: Commit** — `docs(specs): signals — mark implemented through plan 3`

---

## Self-review notes

- **Spec/design coverage:** 4 screens with all designed states; primitives from SigGallery; nav integration; dev proxy + prod nginx; collector deployed with DB bootstrap; sdk.js reachable for plain-HTML consumers. Deliberate v1 omissions (each visible in the design but lacking API support, noted in tasks): regressed chip (no regressed flag on the API), flood ▲/min live rate, "waiting for first signal" poll. These go to the follow-ups list rather than inventing endpoints mid-plan.
- **Type consistency:** wire types defined once in `signals-api.ts`; screens consume hooks only; test-utils shared from Task 4.
- **No placeholders:** every task names exact files, states, and test assertions; screen layout detail intentionally delegates to the design frames, which are in-repo and named per task.
- **Task 9 gate + smoke (2026-07-22):** all gates green — `@tickets/web test` 71 files/280 tests, `pnpm typecheck` 12/12 tasks, `@tickets/web build` succeeds (single >500kB chunk warning, pre-existing, not signals-specific), `@tickets/signals test` 11 files/44 tests, `packages/signals/*` test 11 files/63 tests across core+node+browser+react. Live smoke: `/signals-api/issues` through the vite proxy returned the seeded 2-row payload; `/` returned 200 HTML. Deviation: on this Windows dev box, vite's dev server (no explicit `server.host`) bound `[::1]` only, so `curl http://127.0.0.1:4620/...` got connection-refused while `curl http://localhost:4620/...` succeeded — an environment/Node dual-stack quirk, not a code defect; noted here in case CI or docs scripts ever hardcode `127.0.0.1` against this dev server.
