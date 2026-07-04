# Create status

`POST /api/projects/:key/statuses`

Adds a status to a project. `kind` is the only workflow semantic the code
understands — it drives progress rollups, tiles, and filter buckets.
Position is appended after existing statuses.

**Source:** [`apps/api/src/routes/vocabulary.routes.ts`](../../apps/api/src/routes/vocabulary.routes.ts) — `createStatus`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `key` | Project key |

Body:

```ts
{
  key: string;      // non-empty, unique within the project
  label: string;    // non-empty
  kind: 'todo' | 'active' | 'blocked' | 'done' | 'dropped';
  config?: object;  // e.g. { color: '#0ca30c', description: '...', initial: true }
                    // initial: true marks the default status for new tickets
}
```

## Response

`201 Created` — the status row:

```ts
{
  id: number;
  projectId: number;
  key: string;
  label: string;
  kind: string;
  config: object;
  position: number;
  archivedAt: null;
  createdAt: string;
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Body fails validation |
| `404` | Unknown project key |
| `500` | Duplicate status key in the project (unique-constraint violation, unmapped) |

## Database

- **Reads:** project vocabulary (position)
- **Writes:** `statuses`
- **Events:** none

## Related

- [Update status](update-status.md) · [Create status transition](create-status-transition.md)
- Tickets set status by key via [Update ticket](update-ticket.md)
