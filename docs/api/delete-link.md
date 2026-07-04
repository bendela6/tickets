# Delete link

`DELETE /api/links/:id?actorId=N`

Removes a link between two tickets. The actor travels as a query parameter
because DELETE has no body.

**Source:** [`apps/api/src/routes/links.routes.ts`](../../apps/api/src/routes/links.routes.ts) — `deleteLink`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `id` | Link id (positive integer) |

| Query param | Meaning |
| ----------- | ------- |
| `actorId` | **Required.** User attributed in both tickets' audit trails |

## Response

`200 OK`

```ts
{ deleted: true }
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Invalid link id or missing/invalid `actorId` |
| `404` | Link not found |

## Database

- **Reads:** `ticket_links`
- **Writes** (one transaction): delete from `ticket_links`, `ticket_events` —
  one `link-removed` event per endpoint ticket (`{ linkId }`)

## Related

- [Create link](create-link.md)
- MCP tool [`remove_link`](../mcp/remove-link.md) resolves the link id from
  ticket numbers and wraps this endpoint
