# Update field

`PATCH /api/fields/:id`

Relabels, reconfigures, or archives a field. Field `key` and `type` are
immutable; **system fields** (seeded: title, description, status, severity,
epic, area) cannot be archived.

**Source:** [`apps/api/src/routes/vocabulary.routes.ts`](../../apps/api/src/routes/vocabulary.routes.ts) — `patchField`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `id` | Field id (positive integer) |

Body (all optional):

```ts
{
  label?: string;       // non-empty
  config?: object;      // replaces entirely
  archived?: boolean;   // true archives, false unarchives
}
```

## Response

`200 OK` — the updated field row (same shape as [Create field](create-field.md),
`system` may be `true`).

## Errors

| Status | When |
| ------ | ---- |
| `400` | Invalid id or body |
| `404` | Field not found |
| `422` | Attempt to archive a system field |

## Database

- **Reads:** `fields`
- **Writes:** `fields`
- **Events:** none

## Related

- [Create field](create-field.md)
- Archived fields are rejected as value targets by
  [Update ticket](update-ticket.md) and as references by view configs
