# 6 — HTTP API & server process

## Base

- Service: `apps/api` (Fastify)
- Prefix: `/api`
- JSON only
- Mutations carry `actorId` (+ `commandId` when events/idempotency on)
- Lists: `{ data, meta? }` where useful

## Route map

### Workspace

| Method | Path |
| ------ | ---- |
| GET/POST | `/projects` |
| GET | `/projects/:key` |
| GET | `/users` |
| POST | `/users` |

### Project queries

| Method | Path | Returns |
| ------ | ---- | ------- |
| GET | `/projects/:key/board` | vocab + views + items (v1 convenience) |
| GET | `/projects/:key/items` | filtered items (query: viewId, type, q, …) |
| GET | `/projects/:key/structure` | types, fields (+ options/transitions), links |

Split board into structure + items when payloads get large.

### Items

| Method | Path |
| ------ | ---- |
| GET | `/items/:id` |
| POST | `/projects/:key/items` |
| PATCH | `/items/:id` |
| GET | `/items/:id/events` |
| GET | `/items/:id/children` | optional |

### Collaboration

| Method | Path |
| ------ | ---- |
| GET/POST | `/items/:id/comments` |
| POST/DELETE | `/comments/:id/reactions` (or toggle) |
| POST | `/items/:id/links` |
| DELETE | `/links/:id` |

### Structure (settings)

| Method | Path (illustrative) |
| ------ | ------------------- |
| CRUD | `/schemes`, `/schemes/:id/types`, `/fields`, `/item-types/:id/fields` attach |
| CRUD | fields, options, link types; transitions via field `config` |
| CRUD | `/projects/:key/views` |

Exact path nesting can be scheme-scoped or project-scoped-via-scheme; pick **scheme id** for structure writes and **project key** for instance writes.

## Server module layout

**Locked:** command + query registries (not fat route handlers).  
Full tree → [../architecture/1-file-structure.md](../architecture/1-file-structure.md).

```text
apps/api/src/
  http/routes.ts              # thin: URL → runCommand / runQuery
  commands/kinds/*            # item.create, item.patch, type.attachField, …
  queries/kinds/*             # board.list, item.get, …
  events/kinds/*              # item.field_changed, …
  domain/                     # effective-field, check-parent, check-transition
  projections/ · consumers/
```

## Write / read process

See [../architecture/2-pipeline.md](../architecture/2-pipeline.md) and [../events/3-runtime.md](../events/3-runtime.md).

## Error model

| Code | When |
| ---- | ---- |
| 400 | validation, illegal transition, bad parent |
| 404 | missing project/item |
| 409 | optimistic lock / seq conflict |
| 500 | unexpected |

## DTO sketch

```ts
type ItemDto = {
  id: number;
  projectKey: string;
  number: number;
  typeKey: string;
  parentId: number | null;
  archivedAt: string | null;
  updatedAt: string;
  values: Record<string, unknown>;
};
```
