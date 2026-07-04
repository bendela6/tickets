# Create link type

`POST /api/projects/:key/link-types`

Adds an entry to the project's relation vocabulary. A link reads
"source *label* target" and displays from the other side as
"target *inverseLabel* source". Directional types get cycle detection on
[Create link](create-link.md).

**Source:** [`apps/api/src/routes/vocabulary.routes.ts`](../../apps/api/src/routes/vocabulary.routes.ts) — `createLinkType`

## Request

| Path param | Meaning |
| ---------- | ------- |
| `key` | Project key |

Body:

```ts
{
  key: string;           // non-empty, unique within the project
  label: string;         // e.g. "blocks"
  inverseLabel: string;  // e.g. "is blocked by"; same as label for symmetric types
  directional: boolean;  // true → cycles rejected on link creation
}
```

## Response

`201 Created` — the link type row:

```ts
{
  id: number;
  projectId: number;
  key: string;
  label: string;
  inverseLabel: string;
  directional: boolean;
  position: number;
  archivedAt: null;
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Body fails validation |
| `404` | Unknown project key |
| `500` | Duplicate key in the project (unique-constraint violation, unmapped) |

## Database

- **Reads:** project vocabulary (position)
- **Writes:** `link_types`
- **Events:** none

## Related

- [Create link](create-link.md)
- Seeded defaults: `blocks` (directional), `relates-to` (symmetric),
  `duplicates` (directional)
