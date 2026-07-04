# remove_link

**Write tool** — attributed to the configured actor. Removes an existing
relation between two tickets. Takes the same shape as
[`link_tickets`](link-tickets.md) — direction matters: the link must exist
exactly as `sourceNumber → targetNumber`.

**Source:** [`apps/mcp/src/tools/remove-link.ts`](../../apps/mcp/src/tools/remove-link.ts)

## Input

```ts
{
  projectKey: string;
  linkTypeKey: string;
  sourceNumber: number;   // int
  targetNumber: number;   // int
}
```

## Output

JSON text:

```ts
{ removed: true }
```

## Behavior

- Loads the [board](../api/get-board.md), finds the link row matching
  type + source + target, then calls
  [`DELETE /api/links/:id?actorId=N`](../api/delete-link.md).

## Errors

`isError` text: unknown link type, or
`no <linkType> link from <source> to <target>` when the edge doesn't exist
in that direction.

## Related

- [`link_tickets`](link-tickets.md)
