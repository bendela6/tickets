# Architecture — file structure

## Monorepo

```
apps/
  api/          Fastify — commands, queries, events, projections, consumers
  web/          React SPA
  mcp/          MCP — thin over same commands/queries (HTTP or in-process later)
packages/
  db/           Drizzle schema @tickets/db
  core/         shared valibot schemas + DTO types @tickets/core  (LOCKED)
docs/grok/      this design SSOT
```

## `apps/api/src`

```
app.ts
context.ts                 # actor, commandId, tx

http/
  routes.ts                # endpoint → runCommand / runQuery only
  errors.ts

commands/
  registry.ts
  dispatch.ts
  kinds/
    item-create.ts
    item-patch.ts
    item-reparent.ts
    item-archive.ts
    comment-add.ts
    link-add.ts
    field-define.ts
    type-attach-field.ts
    …

queries/
  registry.ts
  dispatch.ts
  kinds/
    item-get.ts
    board-list.ts
    item-activity.ts
    field-library.ts
    structure-get.ts
    …

events/
  registry.ts
  kinds/
    item-created.ts
    item-field-changed.ts
    item-link-added.ts
    type-field-attached.ts
    …

projections/
  item-values.ts
  item-activity.ts
  rebuild.ts                 # Tier B

consumers/
  outbox-worker.ts
  automations.ts
  webhooks.ts

domain/                      # pure helpers
  effective-field.ts
  check-parent.ts
  check-transition.ts
  build-value-rows.ts
```

## `packages/core`

- Event payload schemas (`ItemFieldChangedSchema`, …)
- Command input schemas
- Shared DTO types (`ItemDto`, …)
- Import from api, web, mcp — **one shape**

## Web / MCP

Per [platform/7-web.md](../platform/7-web.md) and [platform/8-mcp.md](../platform/8-mcp.md):  
features + routes; MCP tools call HTTP commands/queries.
