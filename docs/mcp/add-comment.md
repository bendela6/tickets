# add_comment

**Write tool** — attributed to the configured actor. Adds a markdown
comment to a ticket.

**Source:** [`apps/mcp/src/tools/add-comment.ts`](../../apps/mcp/src/tools/add-comment.ts)

## Input

```ts
{
  projectKey: string;
  ticketNumber: number;   // int
  body: string;           // non-empty markdown
}
```

## Output

JSON text:

```ts
{ commented: true; ticketNumber: number }
```

## Behavior

- Loads the [board](../api/get-board.md) to resolve the ticket number, then
  calls [`POST /api/tickets/:id/comments`](../api/add-comment.md) with
  `authorId` set to the configured actor.

## Errors

Unknown project or ticket number returns `isError` text.

## Related

- Comments appear in [`get_ticket`](get-ticket.md) with author names
