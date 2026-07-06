# get_ticket

**Read tool.** Full detail for one ticket: every field value including the
markdown description, comments with author names, links with direction
labels, children, and the 10 most recent events. Read this before working
a ticket.

**Source:** [`apps/mcp/src/tools/get-ticket.ts`](../../apps/mcp/src/tools/get-ticket.ts)

## Input

```ts
{
  projectKey: string;
  ticketNumber: number;   // int — the display number (42 in TASK-42)
}
```

## Output

JSON text — the summary row (defined in Types below) plus:

```ts
{
  // ...SummaryRow fields (number, type, values, parentNumber, children, ...)
  description: string | null;    // markdown
  createdAt: string;
  updatedAt: string;
  comments: {
    by: string;                  // author name
    at: string;
    body: string;                // markdown
  }[];
  links: {
    relation: string;            // link label from THIS ticket's perspective
                                 // ("blocks" outgoing, "is blocked by" incoming)
    linkTypeKey: string;
    ticketNumber: number;        // the other ticket
    title: unknown;              // the other ticket's title
  }[];
  recentEvents: {                // newest 10
    kind: string;
    by: string;                  // actor name
    at: string;
    payload: object;
  }[];
}
```

## Behavior

- Calls [`GET /api/projects/:key/board`](../api/get-board.md), resolves the
  ticket number, then
  [`GET /api/tickets/:id/events?take=10`](../api/list-ticket-events.md).

## Errors

Unknown project or ticket number returns `isError` text
(`no ticket TASK-42 in project "..."`).

## Types

```ts
type SummaryRow = {
  number: number;
  type: string;                 // ticket type key
  // ...every field value except description (e.g. title, status, severity, epic)
  parentNumber: number | null;
  children?: number[];          // unarchived child ticket numbers
  blockedBy?: number[];         // tickets that block this one (via the "blocks" type)
  commentCount?: number;        // omitted when 0
  archived?: true;              // omitted when live
};
```

## Related

- [`list_ticket_events`](list-ticket-events.md) for a longer trail
- [`update_ticket`](update-ticket.md) · [`add_comment`](add-comment.md)
