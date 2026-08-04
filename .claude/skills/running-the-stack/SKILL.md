---
name: running-the-stack
description: Use when starting, restarting, deploying, or screenshotting the app — when a URL is needed for the web app or /gallery, when localhost refuses connection or shows stale code, when /api calls fail, or before driving the app with browser tools.
---

# Running the Stack

## Topology — one container, one postgres server, two databases

| What | Where | Notes |
|---|---|---|
| Deployed app (docker, single container `app`) | http://localhost:4610 | nginx serves the built web SPA and reverse-proxies `/api` to an internal node API (`127.0.0.1:4600` inside the container — not published to the host) and `/signals-api` to the internal signals collector (`127.0.0.1:4640`) |
| Deployed signals collector, direct | http://localhost:4640 | same process as `/signals-api` above, also published directly (`4640:4640`) so external apps' SDKs can send signals + fetch `/sdk.js` without going through `/signals-api`; `/health` and `/sdk.js` work on either path |
| Dev web (vite) | http://localhost:4620 | `strictPort` — fails hard if 4620 is taken; part of `pnpm dev` (mprocs) |
| Dev API (tsx watch) | http://localhost:4600 | part of `pnpm dev` (mprocs); dev web proxies `/api` here |
| Dev signals collector | http://localhost:4640 | part of `pnpm dev` (mprocs) pane "signals"; own db `signals`, independent of the `tickets_dev` switch |
| DB browser (docker) | http://localhost:4610/studio | self-hosted **pgweb** (`--prefix studio`, internal `127.0.0.1:4983`), locked to prod `tickets`. Baked into the image → works offline. (Dev's mprocs `studio` pane still uses drizzle-kit studio, which needs internet.) |
| Postgres (docker) | `127.0.0.1:5532` | ONE server, TWO databases: `tickets` (prod, used by the deployed app) and `tickets_dev` (dev, used by local tooling); loopback-only. Inspect: `docker exec -it tickets-postgres-1 psql -U postgres -d tickets` (or `-d tickets_dev`) |
| Gallery | `/gallery` on either web | primitives showcase; what verifying-a-component measures |
| Icon editor (vite) | http://localhost:4670 | `@tickets/icon` — the canvas icon builder; part of `pnpm dev` (mprocs pane `icon`). Same IPv6 gotcha as the studio: use `localhost`, never `127.0.0.1` |
| Session board (web) | http://localhost:4681 | `@tickets/board` — live view of every Claude Code session on this machine (tasks, prompts, git, decisions, activity). Part of `pnpm dev` (pane `board`) |
| Session board (api) | http://localhost:4680 | read-only local API over `~/.claude`; loopback-only, started by the same pane. The web dev server proxies `/api` here |

## Commands

- Full stack: `docker compose up -d` → postgres (`127.0.0.1:5532`, prod+dev dbs) + app on `:4610` serving everything by path: `/` (web), `/api`, `/signals-api`, `/studio` — plus the signals collector published directly on `:4640`
- Deploy current source to 4610: `sh scripts/deploy-web.sh` (`docker compose up -d --build app`) — at phase boundaries, not every commit
- Dev loop: `pnpm dev` — mprocs dashboard with panes for api (`:4600`), web (`:4620`), studio, watchers, all against `tickets_dev` (`POSTGRES_DATABASE` in root `.env`)
- DB: `pnpm db:migrate` / `db:seed` / `db:import` (hit `127.0.0.1:5532` per `.env` — default `.env.example` points at `tickets_dev`, not prod)
- Checks: `pnpm typecheck` · `pnpm --filter @tickets/web test` · `pnpm build`

## Icon studio

`@tickets/icon-studio` (`packages/web/icon-studio`, port **4660**) is the dev-only tool
that tunes the app mark and, on one button, writes every favicon and install icon into
`apps/web`. `apps/web/icons.config.json` is the source of truth: the studio reads and
writes it, and **Generate** re-derives every other asset (`favicon.svg`, `icon-mono.svg`,
the PNGs, `site.webmanifest`, the `index.html` head block) from it. Nobody hand-edits
`favicon.svg`.

- Run it: `pnpm --filter @tickets/icon-studio dev` (own Vite dev server, not part of
  `pnpm dev`'s mprocs — it's used rarely, so it's started on demand).
- Open it at **`http://localhost:4660`**, not `127.0.0.1:4660` — see the gotcha below.
- Generate writes into `apps/web/public/*`, `apps/web/icons.config.json`, and the marked
  `<!-- icons:start -->…<!-- icons:end -->` block in `apps/web/index.html`.

## Icon editor — the canvas builder (`apps/icon`, port 4670)

A **separate app from the icon studio**, and neither knows about the other. The
studio owns `apps/web`'s six shipped icon files and the tickets mark; the editor
is a general drawing tool whose documents are its own.

- Run it: it comes up with `pnpm dev` as the mprocs pane `icon`, or on its own
  with `pnpm --filter @tickets/icon dev`. Either way, **`http://localhost:4670`**.
- Entirely client-side. Documents live in the browser (IndexedDB), and export
  produces a `.zip` download — there is no write path and no server, so nothing
  here can touch the repo.
- Six export targets are real: favicon `.ico`, PWA + manifest, iOS
  `.appiconset`, Android mipmaps, macOS `.icns` and Windows `.ico`. No runtime
  dependency backs any of them. A document is one static picture — there is no
  animation, and nothing exports motion.
- Checks: `pnpm --filter @tickets/icon test` · `typecheck` · `build`.

## Gotchas — all previously hit

- **On Windows, use `localhost:4660` for the icon studio, never `127.0.0.1:4660`.**
  Windows resolves `localhost` to `::1` (IPv6) first, and Vite's dev server binds only
  that address by default — so `http://127.0.0.1:4660` gets connection-refused while
  `http://localhost:4660` works. This cost an hour to track down once; don't repeat it.
- **4610 shows stale code until `deploy-web.sh` is rerun.** The `app` container is a baked image, not a bind mount. "My fix isn't visible" on 4610 → check 4620 first; if it's right there, 4610 just needs a redeploy (`docker compose up -d --build app`).
- **Dev web with `pnpm dev` down → `/api` proxy ECONNREFUSED.** Vite proxies to `127.0.0.1:4600`; the mprocs api pane must be running.
- **Port 4620 busy → vite exits** (strictPort). Kill the stale dev server; don't switch ports — the verify pipeline and docs assume 4620.
- **One postgres, two databases.** `tickets` is prod (deployed app), `tickets_dev` is dev (local tooling) — same server, same `127.0.0.1:5532`. Double-check `POSTGRES_DATABASE` before running migrations/seeds against a fresh `.env`; never point local tooling at `tickets` by accident.
- **Two published ports in the deployed stack: `:4610` and `:4640`.** `:4610` serves web (`/`), `/api`, `/signals-api`, and `/studio` (pgweb) — api, signals, and pgweb are internal to the container, proxied by nginx. pgweb is a self-hosted Postgres browser (static Go binary baked into the image), so `/studio` needs no internet. (Earlier this used proxied Drizzle Studio, whose hosted UI required internet + an origin-root method-routing hack — replaced by pgweb.) `:4640` is the signals collector published directly, same process as `/signals-api` — external SDKs hit it without the `/signals-api` prefix rewrite.
- Screenshot/measurement sessions should target **4620** (live source) unless explicitly reviewing the deployed build.
