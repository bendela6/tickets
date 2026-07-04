# list_ticket_events

**Read tool.** One ticket's audit trail, newest first: who changed what and
when — status flips, value edits, comments, links, archiving.

**Source:** [`apps/mcp/src/tools/list-ticket-events.ts`](../../apps/mcp/src/tools/list-ticket-events.ts)

## Input

```ts
{
  projectKey: string;
  ticketNumber: number;   // int
  take?: number;          // int, 1–200, default 50
}
```

## Output

JSON text:

```ts
{
  total: number;          // total events on the ticket (not just this page)
  events: {
    kind: string;         // created | status-changed | value-changed | commented | ...
    by: string;           // actor name
    at: string;           // ISO timestamp
    payload: object;      // kind-specific, e.g. { fieldKey, from, to }
  }[];
}
```

## Behavior

- Calls [`GET /api/projects/:key/board`](../api/get-board.md) to resolve the
  ticket number to an id, then
  [`GET /api/tickets/:id/events?take=N`](../api/list-ticket-events.md).

## Errors

Unknown project or ticket number returns `isError` text.

## Related

- [`get_ticket`](get-ticket.md) already includes the 10 most recent events
