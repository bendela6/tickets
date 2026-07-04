# Update field option

`PATCH /api/options/:id`

Relabels, reconfigures, or archives a field option. The stored `value` is
immutable. Archived options stay on existing tickets but are rejected for
new values.

**Source:** [`apps/api/src/routes/vocabulary.routes.ts`](../../apps/api/src/routes/vocabulary.routes.ts) — `patchOption`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `id` | Option id (positive integer) |

Body (all optional):

```ts
{
  label?: string;       // non-empty
  config?: object;      // replaces entirely
  archived?: boolean;   // true archives, false unarchives
}
```

## Response

`200 OK` — the updated option row (same shape as
[Create field option](create-field-option.md)).

## Errors

| Status | When |
| ------ | ---- |
| `400` | Invalid id or body |
| `404` | Option not found |

## Database

- **Reads/Writes:** `field_options` (single update … returning)
- **Events:** none

## Related

- [Create field option](create-field-option.md)
