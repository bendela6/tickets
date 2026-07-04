# Delete status transition

`DELETE /api/status-transitions/:id`

Removes a workflow-graph edge. Deleting the last edge returns the project
to an unrestricted workflow.

**Source:** [`apps/api/src/routes/vocabulary.routes.ts`](../../apps/api/src/routes/vocabulary.routes.ts) — `deleteTransition`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `id` | Transition id (positive integer) |

## Response

`200 OK`

```ts
{ deleted: true }
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Invalid id |
| `404` | Transition not found |

## Database

- **Writes:** delete from `status_transitions`
- **Events:** none

## Related

- [Create status transition](create-status-transition.md)
