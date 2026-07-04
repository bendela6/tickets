# Create link

`POST /api/links`

Relates two tickets in the same project. A link reads as
"source *label* target" — e.g. with the `blocks` type, source blocks target.
Directional link types are checked for cycles before insert.

**Source:** [`apps/api/src/routes/links.routes.ts`](../../apps/api/src/routes/links.routes.ts) — `createLink`, cycle check in
[`apps/api/src/links/check-link-cycle.ts`](../../apps/api/src/links/check-link-cycle.ts)

## Request

Body:

```ts
{
  actorId: number;         // int — attributed on BOTH tickets' audit trails
  linkTypeKey: string;     // must be a live link type of the tickets' project
  sourceTicketId: number;  // internal ticket id
  targetTicketId: number;  // internal ticket id
}
```

## Response

`201 Created` — the link row:

```ts
{
  id: number;
  linkTypeId: number;
  sourceTicketId: number;
  targetTicketId: number;
  createdAt: string;
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Body fails validation; unknown/archived link type |
| `404` | Source or target ticket not found |
| `409` | Exact same link already exists |
| `422` | Self-link; tickets in different projects; the edge would close a cycle in a directional type |

## Database

- **Reads:** `tickets` (both endpoints), vocabulary tables (`link_types` via
  project vocab), `ticket_links` (duplicate check; full edge set of the link
  type for BFS cycle detection)
- **Writes** (one transaction): `ticket_links`, `ticket_events` — one
  `link-added` event **per endpoint ticket** (`{ linkId, linkTypeKey }`)

## Related

- [Delete link](delete-link.md) · [Create link type](create-link-type.md)
- MCP tool [`link_tickets`](../mcp/link-tickets.md) wraps this endpoint
