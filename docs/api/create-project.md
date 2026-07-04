# Create project

`POST /api/projects`

Creates a project and seeds a complete working vocabulary: ticket types
`task` + `subtask`, ten statuses (with `open` marked initial), six system
fields (`title`, `description`, `status`, `severity`, `epic`, `area`),
type–field attachments (`title` required on both types), severity options
(`high`/`medium`/`low`), link types (`blocks`, `relates-to`, `duplicates`),
and a `Default` view. Also ensures the `claude` agent user exists.

**Source:** [`apps/api/src/routes/projects.routes.ts`](../../apps/api/src/routes/projects.routes.ts) — `createProject`, delegating to
[`packages/db/src/seed/seed-project.ts`](../../packages/db/src/seed/seed-project.ts)

## Request

Body:

```ts
{
  key: string;           // non-empty, must be unique across projects
  name: string;          // non-empty
  ticketPrefix: string;  // non-empty, e.g. "TASK"
}
```

## Response

`201 Created` — the project row:

```ts
{
  id: number;
  key: string;
  name: string;
  ticketPrefix: string;
  createdAt: string;
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Body fails validation (missing / empty fields) |
| `500` | Duplicate `key` (unique-constraint violation is not mapped to a friendly status) |

## Database

- **Reads:** `users` (ensure `claude` exists)
- **Writes:** `projects`, `ticket_types`, `statuses`, `fields`,
  `ticket_type_fields`, `field_options`, `link_types`, `views` — all in one
  transaction; plus `users` if `claude` is missing (outside the transaction)
- **Events:** none (project creation is not a ticket mutation)

## Related

- [Get board](get-board.md) to fetch everything that was seeded
- CLI equivalent: `pnpm db:seed <key> <name> <PREFIX>`
