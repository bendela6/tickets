# Signals App Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Full per-app management for Signals — rename, delete, reveal/rotate DSN, clear signals (all/time/release), a releases view with delete-release, an SDK-snippet copy, and an App detail page that hosts it all.

**Architecture:** New collector routes under `/apps` (zero ticket coupling), a shared issue-prune helper invoked by every signal-deletion path, and a web App-detail route + per-row `⋯` menu + dialogs.

**Spec:** `docs/superpowers/specs/2026-07-24-signals-app-management-design.md`

## Global Constraints

- Collector stays decoupled from ticket modules; valibot validation; match `apps/signals/src/routes/apps.routes.ts` conventions.
- **Every signal deletion recomputes issues in the same transaction** via the shared prune helper (drop zero-signal issues; recompute event_count/first_seen/last_seen). Never leave phantom issue counts.
- Destructive UI actions (Delete app, Rotate key) require a typed-confirm; Clear signals shows exactly what will be removed before confirming.
- Ingest key is unchanged by rename; changed by rotate (old DSN dies immediately).
- Existing suites stay green; collector tests need `POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5532 POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres`, test DB `signals_test`. SDK dist is stale-prone — full `pnpm build` before dependent typecheck.
- Branch `feat/signals-app-management` off main; conventional commits scoped `feat(signals|web): …`, one per task, pathspec-scoped (never touch communication.md/ideas.md).

---

### Task 1: Collector — issue-prune helper + clear-signals endpoint

**Files:** Create `apps/signals/src/issue-prune.ts`; add route in a new `apps/signals/src/routes/app-signals.routes.ts` (register it); tests `apps/signals/src/issue-prune.test.ts` + `app-signals.routes.test.ts`.

**Interfaces:**
- `pruneIssues(tx, appId: number): Promise<{ prunedIssues: number }>` — within a transaction: delete issues for the app that no longer have any referencing signal; recompute `event_count` (count of referencing signals), `first_seen` (min client/received), `last_seen` (max) for survivors.
- `DELETE /apps/:id/signals?before=<iso>&release=<r>&kind=<error|log|event>` → `{ deletedSignals, prunedIssues }`. No filters = delete all the app's signals. Filters AND together. 404 if app absent. Runs delete + `pruneIssues` in one transaction.

- [ ] Failing tests: seed an app with 2 issues (errors) + logs across 2 releases; (a) `DELETE …/signals?release=A` removes only A's signals and prunes the now-empty issue, leaving B's issue with a recomputed count; (b) `?before=<cutoff>` deletes only older; (c) no-params deletes all + all issues gone; (d) unknown app → 404.
- [ ] Implement helper + route + register. Gate: `pnpm --filter @tickets/signals test` + typecheck. Commit `feat(signals): clear-app-signals endpoint + issue-prune helper`.

### Task 2: Collector — rename, detail-with-dsn, rotate key

**Files:** Modify `apps/signals/src/routes/apps.routes.ts`; append to `apps.routes.test.ts`.

**Interfaces:**
- `PATCH /apps/:id` body `{ name }` (valibot: non-empty ≤100). Re-slugify (reuse the existing slugify); if the new slug belongs to a different app → 409; else update name+slug, return the row. Ingest key untouched.
- Extend `GET /apps/:id` to return `{ ...row, ingestKey, dsn, signals24h, errors24h }` (list `GET /apps` still omits ingestKey).
- `POST /apps/:id/rotate` — set `ingest_key` to a fresh random key (same generator as create); return `{ ...row, ingestKey, dsn }`.

- [ ] Failing tests: rename updates name+slug and keeps ingestKey; rename to a colliding slug → 409; `GET /apps/:id` includes ingestKey+dsn; rotate changes ingestKey (old ≠ new) and the composed dsn.
- [ ] Implement. Gate: signals test + typecheck. Commit `feat(signals): rename, detail-with-dsn, rotate-key routes`.

### Task 3: Collector — delete app (cascade)

**Files:** Modify `apps/signals/src/routes/apps.routes.ts`; append tests.

**Interfaces:** `DELETE /apps/:id` — transaction: delete the app's `signals`, `issues`, `sourcemap_artifacts`, then the `apps` row. 404 if absent. Returns `{ deleted: true }`.

- [ ] Failing tests: seed app + signals + issues + a sourcemap artifact → delete → all four tables have zero rows for that app, other apps untouched; unknown id → 404.
- [ ] Implement. Gate + typecheck. Commit `feat(signals): hard-delete an app and its data`.

### Task 4: Collector — releases list + delete-release

**Files:** Add routes in `app-signals.routes.ts` (or a `releases.routes.ts`); tests.

**Interfaces:**
- `GET /apps/:id/releases` → `{ release, signalCount, errorCount, sourcemapCount, sourcemapBytes, firstSeen, lastSeen }[]`, newest-first. Union of distinct non-null `signals.release` and `sourcemap_artifacts.release`; left-join counts. (A release may have signals but no maps, or maps but no signals yet.)
- `DELETE /apps/:id/releases/:release` — transaction: delete `signals` where release matches + `sourcemap_artifacts` where release matches, then `pruneIssues`. Returns `{ deletedSignals, deletedArtifacts, prunedIssues }`.

- [ ] Failing tests: seed 2 releases (one with maps+signals, one signals-only) → list returns both with correct counts/bytes; delete-release removes that release's signals+artifacts and prunes issues, leaving the other; a release string with url-encoded chars round-trips.
- [ ] Implement. Gate + typecheck. Commit `feat(signals): per-app releases list + delete-release`.

### Task 5: Web — API client + SdkSnippet

**Files:** Modify `apps/web/src/api/signals/signals-api.ts` (+ `use-signals.ts` hooks); create `apps/web/src/components/signals/sdk-snippet.tsx`; test `sdk-snippet.test.tsx`.

**Interfaces:**
- Client fns: `getApp(id)→SignalsAppDetail`, `patchApp(id,name)`, `rotateAppKey(id)`, `deleteApp(id)`, `clearAppSignals(id,filters)`, `listAppReleases(id)→AppReleaseRow[]`, `deleteRelease(id,release)`; matching query hooks + mutations (invalidate apps/app/releases/issues on mutate).
- `SdkSnippet({ dsn, platform })` — renders the copy-paste init for `react|node|browser` with a platform toggle + copy button. Pure/deterministic from the dsn.

- [ ] Failing test: `SdkSnippet` renders the node snippet containing the dsn and `initSignals(`; toggling to browser shows the `<script>`/`Signals.init` form. Type additions compile.
- [ ] Implement. Gate: `pnpm --filter @tickets/web test sdk-snippet` + typecheck. Commit `feat(web): signals app-management API client + SDK snippet`.

### Task 6: Web — App detail page

**Files:** Create `apps/web/src/routes/signals-app-detail-route.tsx` + `apps/web/src/components/signals/app-detail-screen.tsx` + `releases-card.tsx`; wire `router.ts`; make `AppsScreen` rows link to it (and the earlier "Go to app"). Test `app-detail-screen.test.tsx`.

**Interfaces:** `AppDetailScreen({ appId })` — Connect card (DSN field + SdkSnippet), 24h stats, recent issues (reuse issue-row list filtered to the app), `ReleasesCard` (from `listAppReleases`, per-release counts/bytes + delete-release button), and the danger actions (rotate/clear/delete) — actions can defer their dialogs to Task 7 (import the dialogs once they exist; for this task, wire the data + layout + releases delete).

- [ ] Failing test: render with mocked app + releases + issues → shows DSN, a release row with its counts, and a recent issue; delete-release calls the endpoint and refetches.
- [ ] Implement route + screen + releases card + nav. Gate: web test + typecheck. Commit `feat(web): Signals app detail page + releases card`.

### Task 7: Web — row ⋯ menu + management dialogs

**Files:** Modify `apps/web/src/components/signals/apps-screen.tsx` (row `⋯` menu); create `rename-app-dialog.tsx`, `rotate-key-dialog.tsx`, `clear-signals-dialog.tsx`, `delete-app-dialog.tsx`; wire the same dialogs into `AppDetailScreen`. Tests for the dialogs' guard behavior.

**Interfaces:**
- Row `⋯` (radix dropdown, match existing menus): Open · Rename · Reveal DSN · Rotate key · Clear signals · Delete.
- `DeleteAppDialog` / `RotateKeyDialog` — typed-confirm (type the slug) before the destructive call. `ClearSignalsDialog` — mode picker (all / older-than <7d|14d|30d> / release <select from listAppReleases>), shows a count preview, confirm. `RenameAppDialog` — text field, submit → patchApp.

- [ ] Failing tests: DeleteAppDialog's confirm button is disabled until the slug is typed exactly; ClearSignalsDialog with mode=release sends `{release}`; rename submits the new name.
- [ ] Implement menu + dialogs on both the row and the detail page. Gate: full web suite + typecheck. Commit `feat(web): per-app actions menu + management dialogs`.

### Task 8: Gate + deploy + live verify

- [ ] Suites: signals, web, SDK packages; `pnpm build`; `pnpm typecheck`.
- [ ] Live proof (dev or container): create a throwaway app → reveal DSN → rename → clear-by-release on a seeded release → delete the app; confirm each via the collector.
- [ ] Rebuild container (`sh scripts/deploy-web.sh`); verify the detail page + `⋯` menu on `:4610`, and delete one of the junk apps (smoke/playground/test) end to end.
- [ ] Update `docs/signals-sdk.md` (app management + the reveal/rotate/clear/release semantics). Commit `docs(signals): app management notes`.

## Self-review notes

- Coverage: rename (T2), delete (T3), reveal DSN (T2 GET + T5 client), rotate (T2), clear all/time/release (T1), releases list+delete (T4), SDK snippet (T5), detail page (T6), row menu + dialogs (T7). Every spec item mapped.
- The issue-prune helper (T1) is the single consistency chokepoint reused by clear-signals (T1), delete-app cascade (T3), and delete-release (T4).
- Not done (deliberate): pause/disable, rate-limit, soft-delete/archive, retention policy.
