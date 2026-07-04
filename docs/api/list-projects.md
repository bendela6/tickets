# List projects

`GET /api/projects`

Returns every project. There is no pagination — the meta envelope always
covers the full set.

**Source:** [`apps/api/src/routes/projects.routes.ts`](../../apps/api/src/routes/projects.routes.ts) — `listProjects`

## Request

No parameters.

## Response

`200 OK`

```ts
{
  data: {
    id: number;
    key: string;           // URL-safe project key, e.g. "tickets"
    name: string;
    ticketPrefix: string;  // display prefix, e.g. "TASK" in TASK-42
    createdAt: string;     // ISO timestamp
  }[];
  meta: { skip: 0; take: number; total: number; sort: null };
}
```

## Errors

None specific — only the generic `500 { error: "internal error" }`.

## Database

- **Reads:** `projects` (full table scan)
- **Writes:** none

## Related

- MCP tool [`list_projects`](../mcp/list-projects.md) wraps this endpoint
- [Create project](create-project.md)
