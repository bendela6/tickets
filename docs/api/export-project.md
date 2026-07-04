# Export project

`GET /api/projects/:key/export`

The [board payload](get-board.md) plus every `ticket_events` row for the
project's tickets and an `exportedAt` stamp — the canonical JSON dump for
backup or diffing.

**Source:** [`apps/api/src/routes/projects.routes.ts`](../../apps/api/src/routes/projects.routes.ts) — `exportProject`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `key` | Project key |

## Response

`200 OK`

```ts
{
  exportedAt: string;    // ISO timestamp of the export
  // ...the entire board payload (see Get board)...
  events: {
    id: number;
    ticketId: number;
    actorId: number;
    kind: string;        // created | status-changed | value-changed | commented | ...
    payload: object;
    createdAt: string;
  }[];
}
```

## Errors

| Status | When |
| ------ | ---- |
| `404` | Unknown project key |

## Database

- **Reads:** everything [Get board](get-board.md) reads, plus `ticket_events`
- **Writes:** none

## Related

- [Get board](get-board.md)
- [List ticket events](list-ticket-events.md) for a single ticket's trail
