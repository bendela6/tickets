# Update view

`PATCH /api/views/:id`

Renames, reconfigures, or archives a view. A supplied config replaces the
old one wholesale and is re-validated against the project's fields.

**Source:** [`apps/api/src/routes/views.routes.ts`](../../apps/api/src/routes/views.routes.ts) — `patchView`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `id` | View id (positive integer) |

Body (all optional — send what changes):

```ts
{
  name?: string;         // non-empty
  config?: object;       // same shape as Create view; replaces entirely
  archived?: boolean;    // true archives, false unarchives
}
```

## Response

`200 OK` — the updated view row (same shape as [Create view](create-view.md)).

## Errors

| Status | When |
| ------ | ---- |
| `400` | Invalid id; config shape invalid; any `fieldId` unknown or archived |
| `404` | View not found |

## Database

- **Reads:** `views`, project vocabulary (only when `config` is supplied)
- **Writes:** `views`
- **Events:** none

## Related

- [Create view](create-view.md)
