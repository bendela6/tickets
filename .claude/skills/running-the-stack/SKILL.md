---
name: running-the-stack
description: Use when starting, restarting, deploying, or screenshotting the app — when a URL is needed for the web app or /gallery, when localhost refuses connection or shows stale code, when /api calls fail, or before driving the app with browser tools.
---

# Running the Stack

## Topology — two webs, one api, two postgreses

| What | Where | Notes |
|---|---|---|
| Deployed web (docker, nginx) | http://localhost:4610 | stable URL for reviewing redesign progress |
| Dev web (vite) | http://localhost:4620 | `strictPort` — fails hard if 4620 is taken |
| API (docker) | http://localhost:4600 | dev web proxies `/api` here |
| Docker postgres | not published to host | inspect: `docker compose exec postgres psql -U postgres tickets` |
| Dev postgres | host port 5532 | per `.env`; a different database than docker's |
| Gallery | `/gallery` on either web | primitives showcase; what verifying-a-component measures |

## Commands

- Full stack: `docker compose up -d` → postgres + api:4600 + web:4610
- Deploy current source to 4610: `sh scripts/deploy-web.sh` — at phase boundaries, not every commit
- Dev loop: `WEB_DEV_PORT=4620 pnpm --filter @tickets/web dev` (docker api must be up for `/api`)
- DB: `pnpm db:migrate` / `db:seed` / `db:import` (hit dev postgres 5532 via `.env`)
- Checks: `pnpm typecheck` · `pnpm --filter @tickets/web test` · `pnpm build`

## Gotchas — all previously hit

- **4610 shows stale code until `deploy-web.sh` is rerun.** The docker web is a baked image, not a bind mount. "My fix isn't visible" on 4610 → check 4620 first; if it's right there, 4610 just needs a redeploy.
- **Dev web with docker down → `/api` proxy ECONNREFUSED.** Vite proxies to `127.0.0.1:4600`; start the docker api first.
- **Port 4620 busy → vite exits** (strictPort). Kill the stale dev server; don't switch ports — the verify pipeline and docs assume 4620.
- **Two postgreses.** Docker's is internal-only; host 5532 is the dev DB. Never "fix" connectivity by pointing docker services at 5532.
- Screenshot/measurement sessions should target **4620** (live source) unless explicitly reviewing the deployed build.
