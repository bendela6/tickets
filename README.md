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
cp .env.example .env          # postgres on 127.0.0.1:5532, db "tickets"
pnpm install
pnpm db:migrate               # apply schema
pnpm db:import                # one-shot import of ../items-core/tasks (optional)
pnpm dev                      # turbo: api on 4600 + web on 4610
```

New empty project: `pnpm db:seed <key> <name> <PREFIX>` or `POST /api/projects`.

## MCP server

Lets any Claude session read and write the tracker with attributed actions.
It talks to the HTTP API only (start the API first), and resolves
`TICKETS_ACTOR` to a user at startup — every mutation lands in the ticket's
activity feed under that name.

Register in Claude Code (user scope):

```sh
claude mcp add tickets --scope user -- node <repo>/apps/mcp/node_modules/tsx/dist/cli.mjs <repo>/apps/mcp/src/server.ts
```

Environment: `TICKETS_API_URL` (default `http://127.0.0.1:4600`),
`TICKETS_ACTOR` (default `claude`).

Tools — read: `list_projects`, `get_board` (token-lean summary),
`get_ticket` (full detail incl. recent events), `search_tickets`,
`list_ticket_events`. Write (all attributed): `create_ticket`,
`update_ticket` (handles optimistic-lock retries internally),
`add_comment`, `link_tickets`, `remove_link`.
Tools address tickets by project key + number (never internal ids).
