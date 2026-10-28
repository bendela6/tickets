# tickets

Multi-project ticket tracker with fully dynamic fields. Everything user-visible
on a ticket (title, status, severity, epic, …) is a field definition + typed
value in Postgres; ticket types, statuses (with a workflow graph), views, and
link types are all data.

## Layout

| Package       | What                                                              |
| ------------- | ----------------------------------------------------------------- |
| `packages/db` | drizzle schema, migrations, seed factory, items-core importer     |
| `apps/api`    | Fastify HTTP API (port 4600) — the only thing that touches the DB |
| `apps/web`    | React dashboard (port 4610) — views, table, drawer, dialog        |

## Quick start

```sh
cp .env.example .env          # postgres on 127.0.0.1:5532, db "tickets_dev"
pnpm install
pnpm db:migrate               # apply schema
pnpm db:import                # one-shot import of ../items-core/tasks (optional)
pnpm dev                      # mprocs: api on 4600 + web on 4620 + studio + watchers
```

New empty project: `pnpm db:seed <key> <name> <PREFIX> [software|plan]` (the scheme, `software` by default) or `POST /api/projects`.

## Run in Docker

```sh
docker compose up -d --build
```

Two services: `postgres` (17-alpine, own named volume `tickets-pgdata`,
published loopback-only on `127.0.0.1:5532`, holding both the `tickets`
(prod) and `tickets_dev` (dev) databases) and `app` — a single container
running nginx on [http://127.0.0.1:4610](http://127.0.0.1:4610) that serves
the built web SPA and reverse-proxies `/api` to an internal node API
(`127.0.0.1:4600`, not published to the host), plus a self-hosted DB browser
(pgweb) at [http://localhost:4610/studio](http://localhost:4610/studio) (same
port; baked into the image, works offline). `pnpm dev` (mprocs) uses its
own ports (api `:4600`, web `:4620`) against `tickets_dev` on the same
postgres, so dev and the deployed container can run side by side.

- Inspect the DB: `docker exec -it tickets-postgres-1 psql -U postgres -d tickets` (or `-d tickets_dev`)
- Logs: `docker compose logs -f app`
- Stop: `docker compose down` (add `-v` to also drop the data volume)

## HTTP API

Fastify on `:4600`, the only process that touches Postgres. Its routes are in
`apps/api/src/routes/`, one file per area.

## Where your checkouts are (`repos.json`)

tickets keeps each project's git link (Settings → Repository), the same for
everyone. Where you have that repository checked out is yours, so it stays on
your machine, in `~/.config/tickets/repos.json` (on Windows
`C:/Users/<you>/.config/tickets/repos.json`): a project's prefix to its folder.

```json
{ "GW": "C:/Users/bbend/Desktop/Projects/gateway", "TK": "C:/Users/bbend/Desktop/Projects/tickets" }
```

The sessions and the builder read it; tickets never sees a path. Change it with
`scripts/tickets-repos.mjs`:

```sh
node scripts/tickets-repos.mjs set TK ../tickets   # check it's a checkout of TK's git link, then keep it
node scripts/tickets-repos.mjs get TK              # print the folder; fails when this machine has none
node scripts/tickets-repos.mjs list                # every folder, flagging the ones that are gone
node scripts/tickets-repos.mjs remove TK           # forget TK's folder
```

- **The key** is the project's prefix (`TK`, `GW`), as the plans name projects;
  its key in tickets (`tickets`, `gateway`) works too, and is kept under the prefix.
- **`set` checks before it writes.** The folder must be in a git checkout (its
  top folder is what's kept), and one of its remotes must be the project's git
  link. Links are compared by host and path: `https://github.com/o/r`,
  `git@github.com:o/r.git` and `ssh://git@github.com:22/o/r/` are one
  repository, in upper or lower case; an ssh host alias from `~/.ssh/config` counts as its
  `HostName`. A project with no git link in tickets can't be set yet.
- **Nothing guesses.** `get`, and `folderOf` for scripts, answer a project with
  no folder, or one whose folder is gone, with the reason instead of a folder:

  ```js
  import { folderOf } from './scripts/tickets-repos.mjs';
  const { folder, reason } = folderOf('TK'); // folder: null, reason: "This machine has no folder for TK. …"
  ```

- **Environment:** `TICKETS_API_URL` is tickets' API, which has the git links
  (default `http://127.0.0.1:4600`);
  `TICKETS_REPOS_FILE` moves the file.
- **Tests:** `node --test scripts/tickets-repos.test.mjs` (a temporary file,
  git repositories and a stub API; never your real file).
