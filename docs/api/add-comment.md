# Add comment

`POST /api/tickets/:id/comments`

Adds a markdown comment to a ticket, attributed to `authorId`.

**Source:** [`apps/api/src/routes/comments.routes.ts`](../../apps/api/src/routes/comments.routes.ts) — `createComment`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `id` | Internal ticket id (positive integer) |

Body:

```ts
{
  authorId: number;   // int — comment author, also the event actor
  body: string;       // non-empty; rendered as markdown by clients
}
```

## Response

`201 Created` — the comment row:

```ts
{
  id: number;
  ticketId: number;
  authorId: number;
  body: string;
  createdAt: string;
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Invalid id or body fails validation |
| `404` | Ticket not found |

## Database

One transaction:

- **Reads:** `tickets` (existence check)
- **Writes:** `comments`, `ticket_events` (one `commented` event with
  `{ commentId }`)

## Related

- Comments are returned inline by [Get board](get-board.md)
- MCP tool [`add_comment`](../mcp/add-comment.md) wraps this endpoint
