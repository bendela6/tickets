# Update status

`PATCH /api/statuses/:id`

Relabels, reconfigures, or archives a status. `key` and `kind` are
immutable.

**Source:** [`apps/api/src/routes/vocabulary.routes.ts`](../../apps/api/src/routes/vocabulary.routes.ts) — `patchStatus`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `id` | Status id (positive integer) |

Body (all optional):

```ts
{
  label?: string;       // non-empty
  config?: object;      // replaces entirely
  archived?: boolean;   // true archives, false unarchives
}
```

## Response

`200 OK` — the updated status row:

```ts
{
  id: number;
  projectId: number;
  key: string;                 // immutable
  label: string;
  kind: 'todo' | 'active' | 'blocked' | 'done' | 'dropped';   // immutable
  config: object;
  position: number;
  archivedAt: string | null;
  createdAt: string;
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Invalid id or body |
| `404` | Status not found |

## Database

- **Reads/Writes:** `statuses` (single update … returning)
- **Events:** none

## Related

- [Create status](create-status.md)
- Archived statuses are rejected for new ticket values by
  [Update ticket](update-ticket.md)
