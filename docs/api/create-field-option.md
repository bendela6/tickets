# Create field option

`POST /api/fields/:id/options`

Adds an option to a `select` or `multi_select` field. Position is appended
after existing options.

**Source:** [`apps/api/src/routes/vocabulary.routes.ts`](../../apps/api/src/routes/vocabulary.routes.ts) — `createOption`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `id` | Field id (positive integer) |

Body:

```ts
{
  value: string;    // non-empty; what ticket values store, unique per field
  label: string;    // non-empty; what UIs display
  config?: object;  // free-form, e.g. { color: '#d03b3b' }; default {}
}
```

## Response

`201 Created` — the option row:

```ts
{
  id: number;
  fieldId: number;
  value: string;
  label: string;
  config: object;
  position: number;
  archivedAt: null;
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Invalid id or body |
| `404` | Field not found |
| `422` | Field type is not `select` / `multi_select` |
| `500` | Duplicate `value` on the field (unique-constraint violation, unmapped) |

## Database

- **Reads:** `fields`, `field_options` (position)
- **Writes:** `field_options`
- **Events:** none

## Related

- [Update field option](update-field-option.md)
- Tickets reference options by `value` string in
  [Create ticket](create-ticket.md) / [Update ticket](update-ticket.md)
