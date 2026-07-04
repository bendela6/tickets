# HTTP API reference

Fastify server in [`apps/api`](../../apps/api/src/), listening on
`http://127.0.0.1:4600` (`API_PORT`). It is the only process that touches
Postgres; see [database tables](../database.md).

## Conventions

- Every **mutation** carries `actorId` (a user id) and writes a
  `ticket_events` row in the same transaction where ticket state changes.
- **Validation errors** are `400` with the valibot issue detail; all errors
  are `{ "error": "message" }`.
- **List endpoints** return `{ data, meta: { skip, take, total, sort } }`.
- Numeric ids in paths must be positive integers, else `400 invalid id`.
- Unknown project keys resolve to `404 unknown project "<key>"`.

## Endpoints

| Endpoint | Method + path | Description |
| -------- | ------------- | ----------- |
| [List projects](list-projects.md) | `GET /api/projects` | All projects (key, name, ticket prefix) |
| [Create project](create-project.md) | `POST /api/projects` | Create a project and seed its types, statuses, fields, link types, and default view |
| [Get board](get-board.md) | `GET /api/projects/:key/board` | One payload with the full project vocabulary plus every assembled ticket |
| [Export project](export-project.md) | `GET /api/projects/:key/export` | Board payload plus every ticket event — canonical JSON dump |
| [Create ticket](create-ticket.md) | `POST /api/projects/:key/tickets` | Create a ticket; required fields gate creation, status defaults to the initial one |
| [Update ticket](update-ticket.md) | `PATCH /api/tickets/:id` | Optimistically-locked update of values, parent, or archived state |
| [List ticket events](list-ticket-events.md) | `GET /api/tickets/:id/events` | Paginated audit trail of one ticket, newest first |
| [Add comment](add-comment.md) | `POST /api/tickets/:id/comments` | Add a markdown comment to a ticket |
| [Create link](create-link.md) | `POST /api/links` | Relate two tickets; duplicates → 409, cycles in directional types → 422 |
| [Delete link](delete-link.md) | `DELETE /api/links/:id` | Remove a link (actor via query param) |
| [List users](list-users.md) | `GET /api/users` | All users, humans and agents |
| [Create user](create-user.md) | `POST /api/users` | Create a user; idempotent by name |
| [Create view](create-view.md) | `POST /api/projects/:key/views` | Save a table view for a project |
| [Update view](update-view.md) | `PATCH /api/views/:id` | Rename, reconfigure, or archive a view |
| [Create field](create-field.md) | `POST /api/projects/:key/fields` | Define a field, optionally attaching it to ticket types |
| [Update field](update-field.md) | `PATCH /api/fields/:id` | Relabel, reconfigure, or archive a field (system fields can't be archived) |
| [Create field option](create-field-option.md) | `POST /api/fields/:id/options` | Add an option to a select / multi_select field |
| [Update field option](update-field-option.md) | `PATCH /api/options/:id` | Relabel, reconfigure, or archive an option |
| [Create status](create-status.md) | `POST /api/projects/:key/statuses` | Add a status with a workflow kind |
| [Update status](update-status.md) | `PATCH /api/statuses/:id` | Relabel, reconfigure, or archive a status |
| [Create status transition](create-status-transition.md) | `POST /api/projects/:key/status-transitions` | Add a workflow-graph edge (entry edges via `fromStatusKey: null`) |
| [Delete status transition](delete-status-transition.md) | `DELETE /api/status-transitions/:id` | Remove a workflow-graph edge |
| [Create link type](create-link-type.md) | `POST /api/projects/:key/link-types` | Add a relation vocabulary entry (directional or symmetric) |
