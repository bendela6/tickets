# search_tickets

**Read tool.** Filters a project's tickets. All filters are ANDed; matching
tickets come back as [summary rows](get-board.md#output) sorted by number.

**Source:** [`apps/mcp/src/tools/search-tickets.ts`](../../apps/mcp/src/tools/search-tickets.ts)

## Input

```ts
{
  projectKey: string;
  query?: string;             // case-insensitive substring over the ticket number
                              // and ALL field values (including description)
  statusKinds?: string[];     // todo | active | blocked | done | dropped
  statuses?: string[];        // exact status keys
  epic?: string;              // exact epic option value
  typeKey?: string;           // exact ticket type key
  includeArchived?: boolean;  // default false
}
```

## Output

JSON text:

```ts
{
  total: number;
  tickets: SummaryRow[];   // see get_board — includes child tickets, unlike get_board
}
```

## Behavior

- Calls [`GET /api/projects/:key/board`](../api/get-board.md) once and
  filters **client-side** — there is no search endpoint in the API.

## Errors

Unknown project key surfaces the API's 404 message as `isError` text.

## Related

- [`get_board`](get-board.md) · [`get_ticket`](get-ticket.md)
