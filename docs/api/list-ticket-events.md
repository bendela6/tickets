# List ticket events

`GET /api/tickets/:id/events`

Paginated audit trail for one ticket, newest first, with actor names joined
in. Every mutation in the system writes here, so this is the complete
history: creation, status flips, value edits, comments, links, archiving.

**Source:** [`apps/api/src/routes/tickets.routes.ts`](../../apps/api/src/routes/tickets.routes.ts) — `listTicketEvents`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `id` | Internal ticket id (positive integer) |

| Query param | Default | Meaning |
| ----------- | ------- | ------- |
| `skip` | `0` | Offset |
| `take` | `50` | Page size, clamped to 1–200 |

## Response

`200 OK`

```ts
{
  data: {
    id: number;
    ticketId: number;
    actorId: number;
    actorName: string;        // joined from users
    kind: string;             // created | status-changed | value-changed |
                              // parent-changed | archived | unarchived |
                              // commented | link-added | link-removed
    payload: object;          // kind-specific, e.g. { fieldKey, from, to }
    createdAt: string;
  }[];
  meta: {
    skip: number;
    take: number;
    total: number;
    sort: '-createdAt';
  };
}
```

A ticket id that doesn't exist returns an empty list (`total: 0`), not a 404.

## Errors

| Status | When |
| ------ | ---- |
| `400` | Invalid id |

## Database

- **Reads:** `ticket_events` joined to `users`, plus a count query
- **Writes:** none

## Related

- [Export project](export-project.md) dumps all events for a whole project
- MCP tools [`list_ticket_events`](../mcp/list-ticket-events.md) and
  [`get_ticket`](../mcp/get-ticket.md) (last 10 events) wrap this endpoint
