# link_tickets

**Write tool** — attributed to the configured actor. Relates two tickets.
The relation reads as "source *linkType* target" — with `blocks`,
`sourceNumber` blocks `targetNumber` (the target cannot proceed until the
source is done).

**Source:** [`apps/mcp/src/tools/link-tickets.ts`](../../apps/mcp/src/tools/link-tickets.ts)

## Input

```ts
{
  projectKey: string;
  linkTypeKey: string;    // e.g. "blocks" | "relates-to" | "duplicates"
  sourceNumber: number;   // int
  targetNumber: number;   // int
}
```

## Output

JSON text:

```ts
{
  linked: true;
  relation: string;   // e.g. "12 blocks 34"
}
```

## Behavior

- Loads the [board](../api/get-board.md) to resolve both ticket numbers,
  then calls [`POST /api/links`](../api/create-link.md).

## Errors

`isError` text with the API's message: duplicate link (409), self-link,
cycle in a directional type (422), unknown link type.

## Related

- [`remove_link`](remove-link.md)
- Blocking relations surface as `blockedBy` in summary rows
  ([`get_board`](get-board.md))
