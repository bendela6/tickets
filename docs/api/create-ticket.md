# Create ticket

`POST /api/projects/:key/tickets`

Creates a ticket of a given type. Every required field of that type must
have a value; the status defaults to the project's initial status (the one
with `config.initial: true`, else the first) when the caller doesn't pick
one. The ticket number is assigned `max + 1` under a project-row lock, so
concurrent creations can't collide, and so is its key: `PREFIX-number`, or
in a plan project an epic's `PREFIX/E<n>`, a feature's `PREFIX-<n>` and a
ticket's or subticket's parent's key and `.<n>` (see
[Get item by key](get-item-by-key.md#keys)).

**Source:** [`apps/api/src/routes/tickets.routes.ts`](../../apps/api/src/routes/tickets.routes.ts) — `createTicket`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `key` | Project key |

Body:

```ts
{
  actorId: number;                  // int — user attributed in the audit trail
  typeKey: string;                  // must be a live (unarchived) type; immutable afterwards
  parentId?: number | null;         // internal ticket id — makes this a depth-1 child
  values: Record<string, unknown>;  // field key → value, typed per field:
                                    //   text → string          number → number
                                    //   date → ISO string      boolean → boolean
                                    //   json → anything        select → option value string
                                    //   multi_select → string[] of option values
                                    //   status → status key
}
```

## Response

`201 Created` — the ticket skeleton row:

```ts
{
  id: number;
  projectId: number;
  typeId: number;
  parentId: number | null;
  number: number;              // its place in its project, e.g. 42 in TASK-42
  key: string;                 // TASK-42; in a plan project TK/E14, TK-80, TK-80.3
  createdBy: number;           // = actorId
  archivedAt: null;
  createdAt: string;
  updatedAt: string;           // starting optimistic-lock token
}
```

Values are **not** echoed back — fetch the [board](get-board.md) to see the
assembled ticket.

## Errors

| Status | When |
| ------ | ---- |
| `400` | Unknown/archived `typeKey`; a required field is missing, `null`, or `""`; unknown field key; value has the wrong type; unknown option/status value; parent not in this project |
| `404` | Unknown project key |
| `409` | `key "…" is already taken`: the key it would get names another item |
| `422` | Parent is itself a child (hierarchy is depth-1); chosen status is not a valid starting status (when entry edges exist); a plan's ticket or subticket without a parent (`a ticket is made under its parent in a plan: its key is its parent's and the next number under it`) |

## Database

One transaction:

- **Reads:** vocabulary tables (`ticket_types`, `statuses`,
  `status_transitions`, `fields`, `field_options`, `ticket_type_fields`),
  `tickets` (parent check + `SELECT … FOR UPDATE` on `projects` for the number)
- **Writes:** `tickets` (one row), `ticket_values` (one row per value; one per
  option for multi_select), `ticket_events` (one `created` event with the
  final values as payload)

## Related

- [Update ticket](update-ticket.md)
- MCP tool [`create_ticket`](../mcp/create-ticket.md) wraps this endpoint,
  addressing the parent by ticket number instead of id
