# Create field

`POST /api/projects/:key/fields`

Defines a new field for a project and optionally attaches it to ticket
types in the same call. Note the `status` field type is **not** creatable
here — the single status field is seeded with the project.

**Source:** [`apps/api/src/routes/vocabulary.routes.ts`](../../apps/api/src/routes/vocabulary.routes.ts) — `createField`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `key` | Project key |

Body:

```ts
{
  key: string;      // non-empty, unique within the project
  label: string;    // non-empty
  type: 'text' | 'number' | 'date' | 'boolean' | 'json' | 'select' | 'multi_select';
  config?: object;  // free-form, e.g. { widget: 'markdown' }; default {}
  attach?: {
    typeKey: string;       // ticket type to show the field on
    required?: boolean;    // default false — required gates ticket creation
  }[];
}
```

Attachment `position` is appended after the type's existing fields.

## Response

`201 Created` — the field row:

```ts
{
  id: number;
  projectId: number;
  key: string;
  label: string;
  type: string;
  system: false;       // user-created fields are never system fields
  config: object;
  archivedAt: null;
  createdAt: string;
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Body fails validation; unknown `typeKey` in `attach` |
| `404` | Unknown project key |
| `500` | Duplicate field key in the project (unique-constraint violation, unmapped) |

## Database

One transaction:

- **Reads:** project vocabulary, `ticket_type_fields` (position per attach)
- **Writes:** `fields`, `ticket_type_fields`
- **Events:** none

## Related

- [Update field](update-field.md) · [Create field option](create-field-option.md)
- Values for the field are written via [Create ticket](create-ticket.md) /
  [Update ticket](update-ticket.md)
