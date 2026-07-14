# 3 — HTTP API layer

App: `apps/api`. Clean-slate routes and modules use **item** everywhere.

## Route map

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/projects` | list projects |
| POST | `/api/projects` | create project |
| GET | `/api/projects/:key/board` | board: items + vocab for project |
| GET | `/api/projects/:key/stats` | optional aggregates |
| GET | `/api/items/:id` | single item (assembled) |
| POST | `/api/projects/:key/items` | create item |
| PATCH | `/api/items/:id` | update fields / parent / archive |
| GET | `/api/items/:id/events` | activity / event list |
| POST | `/api/items/:id/comments` | add comment |
| POST | `/api/items/:id/links` | create link |
| DELETE | `/api/links/:id` | remove link |
| … | vocab / schemes / views / users | unchanged idea; type paths use `item-types` or `types` |

**Drop** `/api/tickets/*` and `…/tickets` — no aliases in clean slate.

Optional alias only if you need a short transition for humans; default = **no aliases**.

## Request / response shapes

### Assembled item (API resource)

```ts
type ItemDto = {
  id: number;
  projectId: number;
  projectKey: string;
  number: number;           // with prefix in meta or client
  typeId: number;
  typeKey: string;
  parentId: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;        // optimistic lock
  createdBy: number;
  values: Record<string, unknown>; // fieldKey → rendered/primitive value
};
```

### Create

`POST /api/projects/:key/items`

```ts
{
  actorId: number;
  typeKey: string;
  parentId?: number | null;
  values: Record<string, unknown>; // fieldKey → input
  commandId?: string;              // uuid, idempotency when events land
}
```

### Patch

`PATCH /api/items/:id`

```ts
{
  actorId: number;
  expectedUpdatedAt: string;
  parentId?: number | null;
  archived?: boolean;
  values?: Record<string, unknown>;
  commandId?: string;
}
```

### Board

```ts
{
  data: {
    project: ProjectDto;
    itemTypes: ItemTypeDto[];
    fields: FieldDto[];
    // …linkTypes, views (status = option field in fields)
    items: ItemDto[];
  }
}
```

Names in JSON: **`items`**, not `tickets`.

## Module layout (`apps/api/src`)

```text
apps/api/src/
  routes/
    items.routes.ts          # was tickets.routes.ts
    comments.routes.ts       # itemId params
    links.routes.ts
    projects.routes.ts
    views.routes.ts
    vocabulary.routes.ts     # types/fields/options/links
    schemes.routes.ts
    users.routes.ts
    schema.routes.ts
  items/                     # was tickets/
    assemble-items.ts
    build-value-rows.ts
    check-parent.ts
    check-guard.ts
    check-transition.ts
    next-item-number.ts      # was next-ticket-number
    render-value.ts
    check-transition.ts      # option transitions on workflow fields
  events/
    registry.ts
    write-event.ts           # writes aggregate_type item
    defs/…
  vocab/
    load-project-vocab.ts    # itemTypes, fieldsByType, …
  links/
  schemes/
  views/
  app.ts                     # register routes
```

## Handler conventions (unchanged style)

- Valibot body schemas co-located or next to route
- `parseBody` / `parseId`
- Transactions for multi-table writes
- Actor required on mutations
- 409 on optimistic lock failure
- Errors: domain helpers in `errors.ts`

## Domain services (pure where possible)

| Module | Responsibility |
| ------ | -------------- |
| `assembleItems` | join items + values → `ItemDto[]` |
| `buildValueRows` | input map → EAV rows for a type’s fields |
| `checkParent` | parent exists, type child rules, no self |
| `checkTransition` | workflow |
| `nextItemNumber` | `SELECT … FOR UPDATE` on project, max+1 |
| `loadProjectVocab` | types/fields/options/links for board |

## Auth / actor

Unchanged: `actorId` in body (or header later). No rename impact.

## OpenAPI / docs

`docs/api/*` pages retitled to item resources (`create-item.md`, `update-item.md`, `get-board.md` with `items` array). Clean slate = rewrite those pages to match.

## Cross-service

Only `apps/api` talks to DB. Web and MCP use these HTTP paths only.
