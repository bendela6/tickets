# Create user

`POST /api/users`

Creates a user, or returns the existing one when the name is already taken —
idempotent by `name`. Note that `kind` is **not** updated on an existing
user.

**Source:** [`apps/api/src/routes/users.routes.ts`](../../apps/api/src/routes/users.routes.ts) — `createUser`, delegating to
[`packages/db/src/seed/ensure-user.ts`](../../packages/db/src/seed/ensure-user.ts)

## Request

Body:

```ts
{
  name: string;                // non-empty, unique
  kind?: 'human' | 'agent';    // default 'human'
}
```

## Response

`201 Created` — the (new or pre-existing) user row:

```ts
{
  id: number;
  name: string;
  email: string | null;
  kind: 'human' | 'agent';
  archivedAt: string | null;
  createdAt: string;
}
```

## Errors

| Status | When |
| ------ | ---- |
| `400` | Body fails validation |

## Database

- **Reads:** `users` (lookup by name)
- **Writes:** `users` (only when the name is new)
- **Events:** none

## Related

- [List users](list-users.md)
- The MCP server uses this to auto-create its `TICKETS_ACTOR` as an `agent`
