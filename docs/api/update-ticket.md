# Update ticket

`PATCH /api/tickets/:id`

Optimistically-locked update of a ticket's field values, parent, and/or
archived state. The caller must echo the exact `updatedAt` string it last
read; if anyone else moved the ticket since, the request fails with `409`
and the caller refetches and retries. Ticket **type is immutable**.

**Source:** [`apps/api/src/routes/tickets.routes.ts`](../../apps/api/src/routes/tickets.routes.ts) — `patchTicket`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `id` | Internal ticket id (positive integer) |

Body (**strict** — unknown keys are rejected):

```ts
{
  actorId: number;                   // int — attributed in the audit trail
  expectedUpdatedAt: string;         // the exact updatedAt you last read
  values?: Record<string, unknown>;  // field key → new value; null clears the field
  parentId?: number | null;          // move under a parent / null to detach
  archived?: boolean;                // true archives, false unarchives
}
```

Value typing is the same as [Create ticket](create-ticket.md). Field updates
use **replace semantics**: all existing rows for the field are deleted and
the new rows inserted, which is what keeps single-selects single.

## Response

`200 OK`

```ts
{
  id: number;
  updatedAt: string;   // the new lock token — keep it for the next PATCH
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Invalid id; body fails validation or has unknown keys; unknown/archived field key; wrong value type; attempt to clear the status field |
| `404` | Ticket not found |
| `409` | `expectedUpdatedAt` no longer matches — refetch and retry |
| `422` | Status change not in the workflow graph (message names the illegal move); depth-1 hierarchy violations (parent is a child, ticket already has children, self-parent) |

## Database

One transaction. The lock is taken by updating
`tickets.updated_at = clock_timestamp()` guarded on the old value — zero rows
touched means someone else won.

- **Reads:** `tickets`, vocabulary tables, `ticket_values` (current values,
  to record `from` in events)
- **Writes:** `tickets` (touch + parent/archived columns), `ticket_values`
  (delete + insert per changed field), `ticket_events` — one event per change:
  `parent-changed`, `archived` / `unarchived`, `status-changed`
  (`{ fieldId, fieldKey, from, to }`), `value-changed`

## Related

- [Create ticket](create-ticket.md) · [List ticket events](list-ticket-events.md)
- MCP tool [`update_ticket`](../mcp/update-ticket.md) hides the lock plumbing
  (fetches `updatedAt` itself, retries once on 409)
