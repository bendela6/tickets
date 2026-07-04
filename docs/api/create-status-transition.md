# Create status transition

`POST /api/projects/:key/status-transitions`

Adds an edge to the workflow graph. A project with **zero** edges has an
unrestricted workflow; once edges exist, status changes must follow them
(and once *entry* edges exist, new tickets must start on one).

**Source:** [`apps/api/src/routes/vocabulary.routes.ts`](../../apps/api/src/routes/vocabulary.routes.ts) — `createTransition`; enforcement in
[`apps/api/src/tickets/check-transition.ts`](../../apps/api/src/tickets/check-transition.ts)

## Request

| Path param | Meaning |
| ---------- | ------- |
| `key` | Project key |

Body:

```ts
{
  fromStatusKey: string | null;  // required; null = entry edge (valid starting status)
  toStatusKey: string;
  ticketTypeKey?: string | null; // omit/null = edge applies to all ticket types
}
```

## Response

`201 Created` — the transition row:

```ts
{
  id: number;
  fromStatusId: number | null;
  toStatusId: number;
  ticketTypeId: number | null;
  config: object;
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Body fails validation; unknown status key; unknown ticket type key |
| `404` | Unknown project key |
| `500` | Duplicate edge (unique constraint with nulls-not-distinct, unmapped) |

## Database

- **Reads:** project vocabulary (key → id resolution)
- **Writes:** `status_transitions`
- **Events:** none

## Related

- [Delete status transition](delete-status-transition.md)
- Enforced by [Create ticket](create-ticket.md) (entry edges) and
  [Update ticket](update-ticket.md) (`422` names the illegal move)
