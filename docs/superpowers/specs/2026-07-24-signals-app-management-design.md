# Signals — app management (detail page, releases, per-app actions)

**Date:** 2026-07-24
**Status:** Design — ready to plan
**Owner:** Beka Bendeliani
**Builds on:** the Signals subsystem (`docs/superpowers/specs/2026-07-18-signals-error-collector-design.md`, `2026-07-23-signals-full-logging-design.md`)

## What this is

The Signals **Apps** screen is read-only today: you can create an app and see a roster, but not rename, delete, recover a DSN, rotate a key, clear its data, or manage the source maps/releases that pile up every deploy. This adds a full management surface — a per-app `⋯` menu for quick actions plus a dedicated **App detail page** that is the real home for each app.

## Locked decisions

| Decision | Choice |
| --- | --- |
| Delete | **Hard delete**, gated behind a typed-confirm ("type the slug to delete"). Cascades the app's signals, issues, and source-map artifacts. |
| Rename | Re-slugifies from the new name. Ingest key + DSN are **unchanged** (DSN is `key@host/id`, not slug-based). A slug collision with another app → 409. |
| Reveal DSN | The ingest key is local-first and low-secrecy; `GET /apps/:id` may return it so the detail page can show the DSN again. The list `GET /apps` still omits it. |
| Rotate key | Regenerates the ingest key; the old DSN stops ingesting immediately. Typed-confirm (it breaks live clients). |
| Clear signals | Three modes — **all**, **older-than** (a time cutoff), **by release**. One endpoint, optional filters. |
| Releases | A first-class management unit. A "release" is any distinct `signals.release` value for the app and/or an uploaded source-map artifact. Deleting a release removes its signals **and** its source-map artifacts. (Delete-release == clear-by-release + drop maps.) |
| Issue consistency | Any signal deletion recomputes affected issues in the same transaction: drop issues with zero remaining signals; recompute `event_count`/`first_seen`/`last_seen` for survivors. |
| SDK snippet | Generated **client-side** from the DSN for the chosen platform (react / node / browser `<script>`). No backend involvement. |
| Out of scope | Pause/disable ingest, per-app rate-limit/sample-rate, archive/soft-delete, per-app retention policy. |

## Backend — new collector routes (`apps/signals`)

All under the existing `/apps` surface, zero coupling to ticket modules, valibot-validated, matching `apps.routes.ts` conventions.

- `PATCH /apps/:id` — body `{ name }`. Re-slugify; 409 on slug collision; returns the updated row. Ingest key untouched.
- `GET /apps/:id` — **extend** existing to include `ingestKey` + composed `dsn` (detail page needs it).
- `POST /apps/:id/rotate` — regenerate `ingest_key`; return the new row + DSN.
- `DELETE /apps/:id` — hard delete; cascade `signals`, `issues`, `sourcemap_artifacts` for the app (transaction). 404 if absent.
- `DELETE /apps/:id/signals?before=<iso>&release=<r>&kind=<k>` — delete matching signals (no params = all). Then recompute/prune affected issues. Returns `{ deletedSignals, prunedIssues }`.
- `GET /apps/:id/releases` — list releases for the app: `{ release, signalCount, errorCount, sourcemapCount, sourcemapBytes, firstSeen, lastSeen }[]`, newest-first. Union of distinct `signals.release` and `sourcemap_artifacts.release`.
- `DELETE /apps/:id/releases/:release` — delete that release's signals + source-map artifacts (transaction) + prune issues. Returns `{ deletedSignals, deletedArtifacts, prunedIssues }`.

**Issue-prune helper** (shared by the two delete paths): after deleting signals, `DELETE FROM issues WHERE app_id=? AND id NOT IN (SELECT DISTINCT issue_id FROM signals WHERE issue_id IS NOT NULL)`, then `UPDATE issues SET event_count = (subquery count), first_seen = min, last_seen = max` for the survivors.

## Frontend — web

- **Route** `/signals/apps/$appId` → `AppDetailScreen`. Row click + "Go to app" navigate here.
- **`AppDetailScreen`**: header (name, slug, edit-name inline or via menu); **Connect** card (DSN field + `SdkSnippet` with a react/node/browser toggle + copy); **stats** (24h signals/errors, total, first/last seen); **recent issues** (reuse the issue-row list, filtered to the app, linking into issue detail); **Releases** card (table from `GET /apps/:id/releases` with per-release counts + size + a delete-release action); **danger actions** (Rotate key, Clear signals, Delete app).
- **Row `⋯` menu** on `AppsScreen`: Open · Rename · Reveal DSN · Rotate key · Clear signals · Delete. (A radix dropdown, matching existing menus.)
- **Dialogs**: `RenameAppDialog`, `RotateKeyDialog` (typed-confirm), `ClearSignalsDialog` (mode picker: all / older-than / release), `DeleteAppDialog` (typed-confirm on slug). Reuse `new-app-dialog.tsx` patterns.
- **`SdkSnippet`**: given a DSN + platform, render the copy-paste init. react: `initSignals({ dsn, environment })` + `<SignalsErrorBoundary>`; node: `initSignals({ dsn, registerProcessHandlers: true })`; browser: `<script src=".../sdk.js">` + `Signals.init({ dsn })`.
- **API client** (`signals-api.ts`): `patchApp`, `getApp` (with dsn), `rotateAppKey`, `deleteApp`, `clearAppSignals(filters)`, `listAppReleases`, `deleteRelease`.

## Non-goals (v1)

No pause/disable, no rate-limit/sample-rate, no soft-delete/archive, no retention policy, no cross-app merge/transfer, no notification settings.

## Types

```ts
interface SignalsAppDetail { id: number; name: string; slug: string; ingestKey: string; dsn: string; createdAt: string; signals24h: number; errors24h: number; }
interface AppReleaseRow { release: string; signalCount: number; errorCount: number; sourcemapCount: number; sourcemapBytes: number; firstSeen: string; lastSeen: string; }
interface ClearSignalsFilters { before?: string; release?: string; kind?: 'error' | 'log' | 'event'; }
type SdkPlatform = 'react' | 'node' | 'browser';
```
