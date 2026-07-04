# Database tables

Postgres, managed by drizzle. Schema sources live in
[`packages/db/src/schema/`](../packages/db/src/schema/). Only `apps/api`
touches the database — the web app and MCP server go through the HTTP API.

| Table | Purpose | Key constraints |
| ----- | ------- | --------------- |
| `projects` | One row per project (key, name, ticket prefix) | `key` unique |
| `users` | Humans and agents; every mutation is attributed to one | `name` unique |
| `ticket_types` | Per-project ticket types (seeded: `task`, `subtask`) | unique `(project_id, key)` |
| `statuses` | Per-project statuses with a `kind` enum (`todo · active · blocked · done · dropped`) — the only workflow semantic code knows | unique `(project_id, key)` |
| `status_transitions` | Workflow graph edges. `from_status_id NULL` = valid starting status; `ticket_type_id NULL` = applies to all types; zero rows = unrestricted | unique `(from, to, type)` nulls-not-distinct |
| `fields` | Field definitions (type: `text · number · date · boolean · json · select · multi_select · status`); `system` fields are seeded and cannot be archived | unique `(project_id, key)` |
| `ticket_type_fields` | Which fields a type shows, order, and required flag | PK `(ticket_type_id, field_id)` |
| `field_options` | Options for `select` / `multi_select` fields | unique `(field_id, value)` |
| `views` | Saved table views; `config` holds `{ columns, sort, filters }` referencing fields **by id** | — |
| `tickets` | Skeleton row only — id, number, type, parent, timestamps. Everything user-visible is in `ticket_values`. `updated_at` doubles as the optimistic-lock token | unique `(project_id, number)`; depth-1 hierarchy enforced in the API |
| `ticket_values` | EAV value rows: one row per value, populated column depends on field type; `multi_select` = one row per option | partial unique `(ticket_id, field_id) WHERE option_id IS NULL`; unique `(ticket_id, field_id, option_id)` |
| `comments` | Ticket comments (markdown body) | — |
| `ticket_events` | Append-only audit trail, written **in the same transaction** as the mutation it records; `kind` is free text | indexed `(ticket_id, created_at)` |
| `link_types` | Relation vocabulary per project (seeded: `blocks`, `relates-to`, `duplicates`); `directional` types get cycle detection | unique `(project_id, key)` |
| `ticket_links` | Ticket ↔ ticket edges, "source *label* target". Parent/child is **not** a link — that is `tickets.parent_id` | unique `(link_type_id, source, target)`; check `source <> target` |

## Notes

- **Ticket numbers** are per-project `max + 1`, assigned under
  `SELECT … FOR UPDATE` on the project row
  ([`next-ticket-number.ts`](../apps/api/src/tickets/next-ticket-number.ts)),
  so concurrent creations cannot collide.
- **Optimistic locking**: `PATCH /api/tickets/:id` only lands if
  `tickets.updated_at::text` still equals the `expectedUpdatedAt` the caller
  read; otherwise 409.
- **Single-select uniqueness** for option-carrying rows is app-level — the
  write path replaces all rows of a field in one transaction; the partial
  unique index cannot see rows with `option_id`.
