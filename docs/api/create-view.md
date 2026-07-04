# Create view

`POST /api/projects/:key/views`

Saves a table view for a project. The config references fields **by id**
(never key) so renames can't break a view; every `fieldId` anywhere in the
config — including inside filters and unknown forward-compat keys — must
point at a live field of the project.

**Source:** [`apps/api/src/routes/views.routes.ts`](../../apps/api/src/routes/views.routes.ts) — `createView`, validation in
[`apps/api/src/views/validate-view-config.ts`](../../apps/api/src/views/validate-view-config.ts)

## Request

| Path param | Meaning |
| ---------- | ------- |
| `key` | Project key |

Body:

```ts
{
  name: string;        // non-empty
  config?: {
    columns?: (
      | { source: 'number' | 'type' | 'progress' }                              // built-ins
      | { source: 'field'; fieldId: number; width?: number; hidden?: boolean }
    )[];
    sort?:
      | { source: 'number' | 'type' | 'progress'; dir: 'asc' | 'desc' }
      | { source: 'field'; fieldId: number; dir: 'asc' | 'desc' }
      | null;
    filters?: Record<string, unknown>;
    // unknown extra keys are allowed and pass through untouched
  };
}
```

Defaults to `{}` when omitted. `position` is assigned automatically
(current view count).

## Response

`201 Created` — the view row:

```ts
{
  id: number;
  projectId: number;
  name: string;
  config: object;
  position: number;
  archivedAt: null;
  createdAt: string;
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Body/config shape invalid; any `fieldId` unknown or archived |
| `404` | Unknown project key |

## Database

- **Reads:** project vocabulary (for field validation), `views`
- **Writes:** `views`
- **Events:** none

## Related

- [Update view](update-view.md)
- Views come back inside [Get board](get-board.md)
