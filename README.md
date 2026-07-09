# tickets

Multi-project ticket tracker with fully dynamic fields. Everything user-visible
on a ticket (title, status, severity, epic, …) is a field definition + typed
value in Postgres; ticket types, statuses (with a workflow graph), views, and
link types are all data. See `DESIGN.md` for the full design.

## Layout

| Package       | What                                                              |
| ------------- | ----------------------------------------------------------------- |
| `packages/db` | drizzle schema, migrations, seed factory, items-core importer     |
| `apps/api`    | Fastify HTTP API (port 4600) — the only thing that touches the DB |
| `apps/web`    | React dashboard (port 4610) — views, table, drawer, dialog        |
| `apps/mcp`    | stdio MCP server over the HTTP API                                |

## Quick start

```sh
cp .env.example .env          # postgres on 127.0.0.1:5532, db "tickets_dev"
pnpm install
pnpm db:migrate               # apply schema
pnpm db:import                # one-shot import of ../items-core/tasks (optional)
pnpm dev                      # mprocs: api on 4600 + web on 4620 + studio + watchers
```

New empty project: `pnpm db:seed <key> <name> <PREFIX>` or `POST /api/projects`.

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

The MCP server stays on the host (stdio) — point it at the containerized API
with `TICKETS_API_URL=http://127.0.0.1:4600` (the default).

## HTTP API

Per-endpoint reference — request/response types, error codes, DB tables
touched — lives in [`docs/api/`](docs/api/README.md).

Conventions:

- Every **mutation** carries `actorId` (a user id) and writes a `ticket_events`
  row in the same transaction — full audit trail, humans and agents alike.
- **Ticket PATCH** carries `expectedUpdatedAt` (the exact `updatedAt` string you
  read); a mismatch returns **409** — refetch and retry. Ticket **type is
  immutable** after creation.
- Status changes are validated against the **transition graph** (`422` names the
  illegal move); with zero edges defined, every move is allowed.
- List endpoints use the `{ data, meta: { skip, take, total, sort } }` envelope.
- Errors are `{ "error": "message" }` with a meaningful status code.

### Projects & board

| Method | Path                        | Body / notes                                                                                                                                                  |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/projects`             | list projects                                                                                                                                                 |
| `POST` | `/api/projects`             | `{ key, name, ticketPrefix }` — creates + seeds types/statuses/fields                                                                                         |
| `GET`  | `/api/projects/:key/board`  | one payload: project, users, types, typeFields, statuses, transitions, fields (with options), linkTypes, views, assembled tickets (values + comments + links) |
| `GET`  | `/api/projects/:key/export` | board + every ticket event — canonical JSON dump for backup/diff                                                                                              |

### Tickets

| Method  | Path                         | Body / notes                                                                                                  |
| ------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `POST`  | `/api/projects/:key/tickets` | `{ actorId, typeKey, parentId?, values }` — required fields gate creation; status defaults to the initial one |
| `PATCH` | `/api/tickets/:id`           | `{ actorId, expectedUpdatedAt, values?, parentId?, archived? }` — values map field key → value, `null` clears |
| `GET`   | `/api/tickets/:id/events`    | `?skip&take` — activity feed, newest first                                                                    |
| `POST`  | `/api/tickets/:id/comments`  | `{ authorId, body }`                                                                                          |

### Links

| Method   | Path                       | Body / notes                                                                                                                                   |
| -------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/links`               | `{ actorId, linkTypeKey, sourceTicketId, targetTicketId }` — reads "source _label_ target"; duplicate → 409, cycle in a directional type → 422 |
| `DELETE` | `/api/links/:id?actorId=N` |                                                                                                                                                |

### Users

| Method | Path         | Body / notes                                          |
| ------ | ------------ | ----------------------------------------------------- |
| `GET`  | `/api/users` |                                                       |
| `POST` | `/api/users` | `{ name, kind? }` — kind `human` (default) or `agent` |

### Views

| Method  | Path                       | Body / notes                                                                                                             |
| ------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `POST`  | `/api/projects/:key/views` | `{ name, config? }`                                                                                                      |
| `PATCH` | `/api/views/:id`           | `{ name?, config?, archived? }` — config `{ columns, sort, filters }` must reference fields by **id**; unknown ids → 400 |

### Vocabulary (no UI yet — the API is the editor)

| Method   | Path                                    | Body / notes                                                                                                                                |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/projects/:key/fields`             | `{ key, label, type, config?, attach?: [{ typeKey, required? }] }` — types: `text · number · date · boolean · json · select · multi_select` |
| `PATCH`  | `/api/fields/:id`                       | `{ label?, config?, archived? }` — system fields can't be archived                                                                          |
| `POST`   | `/api/fields/:id/options`               | `{ value, label, config? }` — select/multi_select fields only                                                                               |
| `PATCH`  | `/api/options/:id`                      | `{ label?, config?, archived? }`                                                                                                            |
| `POST`   | `/api/projects/:key/statuses`           | `{ key, label, kind, config? }` — kind: `todo · active · blocked · done · dropped`                                                          |
| `PATCH`  | `/api/statuses/:id`                     | `{ label?, config?, archived? }`                                                                                                            |
| `POST`   | `/api/projects/:key/status-transitions` | `{ fromStatusKey (null = entry edge), toStatusKey, ticketTypeKey? }`                                                                        |
| `DELETE` | `/api/status-transitions/:id`           |                                                                                                                                             |
| `POST`   | `/api/projects/:key/link-types`         | `{ key, label, inverseLabel, directional }`                                                                                                 |

## MCP server

Per-tool reference — input/output shapes and the HTTP calls behind each
tool — lives in [`docs/mcp/`](docs/mcp/README.md).

Lets any Claude session read and write the tracker with attributed actions.
It talks to the HTTP API only (start the API first) and resolves
`TICKETS_ACTOR` to a user at startup — every mutation lands in the ticket's
activity feed under that name. Tools address tickets by **project key +
number**, never internal ids.

Register in Claude Code (user scope):

```sh
claude mcp add tickets --scope user -- node <repo>/apps/mcp/node_modules/tsx/dist/cli.mjs <repo>/apps/mcp/src/server.ts
```

Environment: `TICKETS_API_URL` (default `http://127.0.0.1:4600`),
`TICKETS_ACTOR` (default `claude`).

### Read tools

| Tool                 | Input                                                                            | Returns                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `list_projects`      | —                                                                                | project keys, names, prefixes                                                                                                      |
| `get_board`          | `projectKey`                                                                     | vocabulary (types, statuses+kinds, fields, epics, link types) + one summary row per ticket (no descriptions/comments — token-lean) |
| `get_ticket`         | `projectKey, ticketNumber`                                                       | everything: values incl. markdown description, comments with authors, links with direction labels, children, 10 recent events      |
| `search_tickets`     | `projectKey, query?, statusKinds?, statuses?, epic?, typeKey?, includeArchived?` | matching summary rows                                                                                                              |
| `list_ticket_events` | `projectKey, ticketNumber, take?`                                                | audit trail, newest first                                                                                                          |

### Write tools (all attributed to the configured actor)

| Tool            | Input                                                         | Notes                                                                                                                                         |
| --------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_ticket` | `projectKey, typeKey, values, parentNumber?`                  | required fields depend on the type; status defaults to the initial one                                                                        |
| `update_ticket` | `projectKey, ticketNumber, values?, parentNumber?, archived?` | fetches fresh `updatedAt` itself and retries once on 409 — no lock plumbing for callers; illegal transitions surface the server's 422 message |
| `add_comment`   | `projectKey, ticketNumber, body`                              | markdown                                                                                                                                      |
| `link_tickets`  | `projectKey, linkTypeKey, sourceNumber, targetNumber`         | "source _linkType_ target"; cycles in directional types are rejected                                                                          |
| `remove_link`   | `projectKey, linkTypeKey, sourceNumber, targetNumber`         |                                                                                                                                               |

Tool failures come back as readable `isError` text results (e.g. the server's
validation message), not protocol errors.
