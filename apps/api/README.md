# @tickets/api

tickets' HTTP API: projects, items, comments and links, and each project's types, fields and views.
Fastify, with data in Postgres through [@tickets/db](../../packages/db/README.md).

## Run it alone

```sh
pnpm --filter @tickets/api dev    # http://127.0.0.1:4600, restarts on change
pnpm --filter @tickets/api test   # against tickets_test, which it migrates first
```

Postgres and the workspace setup are in the [root README](../../README.md). Without a database the
API waits for one, then exits.

## How a write works

1. The body carries `commandId` (a uuid) and `actorId` beside its own fields.
2. The route runs a command. In one transaction it records the command, its events and an outbox
   row for each event. Sending the same `commandId` again returns the first result.
3. The outbox worker, in the same process, adds each event to the activity feed, then runs the
   automations in `src/automation/rules`, which write through commands of their own.

## Endpoints

| Endpoint                                                               | Does                                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `GET /api/projects`, `POST /api/projects`, `PATCH /api/projects/:id`   | Lists, adds and changes projects.                                       |
| `GET /api/projects/:key/board`                                         | Everything a project's board needs: items, types, fields, views.        |
| `GET /api/projects/:key/export`                                        | The board's payload with a version tag.                                 |
| `GET /api/projects/:id/activity`                                       | A project's activity.                                                   |
| `POST /api/projects/:key/views`, `PATCH /api/views/:id`                | Adds and changes a view.                                                |
| `POST /api/projects/:key/items`, `PATCH /api/items/:id`                | Adds an item; changes its fields.                                       |
| `GET /api/items/by-key/*`                                              | An item by its key. An epic's slash (`TK/E14`) may come encoded.        |
| `GET /api/items/:id/activity`, `GET /api/items/:id/events`             | An item's activity feed; its raw events.                                |
| `POST /api/items/:id/comments`, `DELETE /api/comments/:id`             | Adds a comment; deletes one (its author only).                          |
| `POST /api/links`, `DELETE /api/links/:id`                             | Links two items; removes a link.                                        |
| `POST /api/attachments`, `GET /api/attachments/:id`                    | Takes an image as raw bytes (PNG, JPEG, GIF, WebP, 10 MB); serves it.   |
| `POST /api/types`, `PATCH /api/types/:id`                              | Adds and changes an item type.                                          |
| `PUT /api/types/:id/child-types`                                       | Sets which types an item of this type may hold.                         |
| `POST /api/types/:typeId/fields`, `PATCH /api/fields/:id`              | Adds a field to a type; changes a field.                                |
| `POST`, `PATCH`, `DELETE /api/types/:typeId/fields/:fieldId/placement` | Shows a field on a type, moves it, takes it off.                        |
| `POST /api/fields/:id/options`, `PATCH /api/options/:id`               | Adds and changes a field's options.                                     |
| `POST /api/fields/:id/transitions`, `DELETE /api/transitions/:id`      | Allows and forbids a move between two options: the workflow.            |
| `POST /api/types/:typeId/link-types`, `PATCH /api/link-types/:id`      | Adds and changes a kind of link.                                        |
| `PUT /api/link-types/:id/target-types`                                 | Sets which types a kind of link may point at.                           |
| `POST /api/schemes/:id/fork`                                           | Copies a scheme with its types, fields and options.                     |
| `GET /api/users`, `POST /api/users`                                    | Lists and adds users.                                                   |
| `GET /api/schema/databases`, `GET /api/schema?database=`               | The server's databases; one database's tables, for the web's `/schema`. |

## Configuration

| Variable         | Default     | What it is                              |
| ---------------- | ----------- | --------------------------------------- |
| `API_PORT`       | `4600`      | Port to listen on.                      |
| `API_HOST`       | `127.0.0.1` | Address to listen on.                   |
| `OUTBOX_POLL_MS` | `500`       | How often the worker checks the outbox. |

The Postgres connection is the `POSTGRES_*` variables in
[packages/db](../../packages/db/README.md#configuration).

## Used by

[apps/web](../web/README.md).
