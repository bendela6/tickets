# List users

`GET /api/users`

Returns every user — humans and agents. No pagination.

**Source:** [`apps/api/src/routes/users.routes.ts`](../../apps/api/src/routes/users.routes.ts) — `listUsers`

## Request

No parameters.

## Response

`200 OK`

```ts
{
  data: {
    id: number;
    name: string;                 // unique
    email: string | null;
    kind: 'human' | 'agent';
    archivedAt: string | null;
    createdAt: string;
  }[];
  meta: {
    skip: 0;
    take: number;      // = total — no pagination on this endpoint
    total: number;
    sort: null;
  };
}
```

## Errors

None specific.

## Database

- **Reads:** `users`
- **Writes:** none

## Related

- [Create user](create-user.md)
- The MCP server calls this at startup to resolve `TICKETS_ACTOR` to a user id
