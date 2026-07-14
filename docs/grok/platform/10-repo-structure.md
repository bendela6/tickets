# 10 — Repository structure

## Top level

```text
repo/
  apps/
    api/                 # Fastify — command/query/event registries
    web/                 # React SPA
    mcp/                 # MCP server
  packages/
    db/                  # Drizzle @tickets/db
    core/                # @tickets/core shared schemas/DTOs (LOCKED)
  docs/grok/             # design SSOT (platform, fields, events, architecture)
  docker/ · package.json · pnpm-workspace · turbo.json
```

See also [../architecture/1-file-structure.md](../architecture/1-file-structure.md).

## `packages/db`

```text
packages/db/src/
  schema/
    users.ts
    schemes.ts
    projects.ts
    item-types.ts
    item-type-child-types.ts
    fields.ts
    item-type-fields.ts
    field-options.ts          # includes status options; no statuses table
    link-types.ts
    link-type-target-types.ts
    views.ts
    items.ts
    item-values.ts
    item-links.ts
    comments.ts
    comment-reactions.ts
    events.ts
    commands.ts
    outbox.ts
    item-activity.ts
    index.ts
    registry.ts
    schema-groups.ts
  seed/
  migrate.ts
  client.ts
```

## `apps/api`

See [6-api.md](6-api.md) module tree: `identity/`, `workspace/`, `structure/`, `records/`, `history/`.

## `apps/web`

See [7-web.md](7-web.md): `api/`, `routes/`, `features/`, `ui/`.

## `apps/mcp`

See [8-mcp.md](8-mcp.md).

## Naming rules

| Do | Don't |
| -- | ----- |
| `item`, `Item`, `items` | `ticket` in new code paths |
| `item_types`, `ItemType` | `ticket_types` |
| feature folders by capability | god `components/` dump of unrelated screens |
| colocate route + thin page | fat route files with all UI |

## Tooling

- `pnpm dev` — api + web + db watchers (mprocs)
- `pnpm typecheck` / `test` / `build` via turbo
- Docker single container optional for deploy

## Optional shared package

`packages/contracts` — zod/valibot-free exported TS types for `ItemDto`, event payloads, shared by api (re-export) and web. Only add if import friction is real; until then web mirrors api types in `api/types.ts`.
