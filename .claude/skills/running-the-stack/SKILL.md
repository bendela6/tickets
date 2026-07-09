---
name: running-the-stack
description: Use when starting, restarting, deploying, or screenshotting the app — when a URL is needed for the web app or /gallery, when localhost refuses connection or shows stale code, when /api calls fail, or before driving the app with browser tools.
---

# Running the Stack

## Topology — one container, one postgres server, two databases

| What | Where | Notes |
|---|---|---|
| Deployed app (docker, single container `app`) | http://localhost:4610 | nginx serves the built web SPA and reverse-proxies `/api` to an internal node API (`127.0.0.1:4600` inside the container — not published to the host) |
| Dev web (vite) | http://localhost:4620 | `strictPort` — fails hard if 4620 is taken; part of `pnpm dev` (mprocs) |
| Dev API (tsx watch) | http://localhost:4600 | part of `pnpm dev` (mprocs); dev web proxies `/api` here |
| Drizzle Studio (docker) | http://localhost:4984 | nginx-served on a dedicated port (medialib-style origin); redirects to `/studio`, browses the prod `tickets` db. Loopback-only. The raw studio server (`127.0.0.1:4983`) is container-internal |
| Postgres (docker) | `127.0.0.1:5532` | ONE server, TWO databases: `tickets` (prod, used by the deployed app) and `tickets_dev` (dev, used by local tooling); loopback-only. Inspect: `docker exec -it tickets-postgres-1 psql -U postgres -d tickets` (or `-d tickets_dev`) |
| Gallery | `/gallery` on either web | primitives showcase; what verifying-a-component measures |

## Commands

- Full stack: `docker compose up -d` → postgres (`127.0.0.1:5532`, prod+dev dbs) + app on `:4610` (web + internal api) + studio on `http://localhost:4984` (nginx)
- Deploy current source to 4610: `sh scripts/deploy-web.sh` (`docker compose up -d --build app`) — at phase boundaries, not every commit
- Dev loop: `pnpm dev` — mprocs dashboard with panes for api (`:4600`), web (`:4620`), studio, watchers, all against `tickets_dev` (`POSTGRES_DATABASE` in root `.env`)
- DB: `pnpm db:migrate` / `db:seed` / `db:import` (hit `127.0.0.1:5532` per `.env` — default `.env.example` points at `tickets_dev`, not prod)
- Checks: `pnpm typecheck` · `pnpm --filter @tickets/web test` · `pnpm build`

## Gotchas — all previously hit

- **4610 shows stale code until `deploy-web.sh` is rerun.** The `app` container is a baked image, not a bind mount. "My fix isn't visible" on 4610 → check 4620 first; if it's right there, 4610 just needs a redeploy (`docker compose up -d --build app`).
- **Dev web with `pnpm dev` down → `/api` proxy ECONNREFUSED.** Vite proxies to `127.0.0.1:4600`; the mprocs api pane must be running.
- **Port 4620 busy → vite exits** (strictPort). Kill the stale dev server; don't switch ports — the verify pipeline and docs assume 4620.
- **One postgres, two databases.** `tickets` is prod (deployed app), `tickets_dev` is dev (local tooling) — same server, same `127.0.0.1:5532`. Double-check `POSTGRES_DATABASE` before running migrations/seeds against a fresh `.env`; never point local tooling at `tickets` by accident.
- **No `:4600` on the host in the deployed stack.** The api is internal-only inside the `app` container behind nginx; only `:4610` (app) and `127.0.0.1:4984` (studio via nginx) are published. Studio needs a dedicated origin (its own port) because drizzle's UI POSTs its data protocol to the origin root — on `:4610` that root is the SPA, so it can't live under `:4610/studio`.
- Screenshot/measurement sessions should target **4620** (live source) unless explicitly reviewing the deployed build.
