# get_board

**Read tool.** Project orientation: the working vocabulary (ticket types,
statuses with kinds, fields, epics, link types) plus one **summary row**
per ticket. Token-lean by design — no descriptions or comment bodies; use
[`get_ticket`](get-ticket.md) for depth. Call this before working in a
project.

**Source:** [`apps/mcp/src/tools/get-board.ts`](../../apps/mcp/src/tools/get-board.ts), summary shape in
[`apps/mcp/src/helpers/summarize-ticket.ts`](../../apps/mcp/src/helpers/summarize-ticket.ts)

## Input

```ts
{
  projectKey: string;
}
```

## Output

JSON text:

```ts
{
  project: { id; key; name; ticketPrefix; createdAt };
  types: string[];                            // unarchived type keys
  statuses: { key: string; kind: 'todo' | 'active' | 'blocked' | 'done' | 'dropped' }[];
  fields: { key: string; type: string; options?: string[] }[];  // unarchived
  epics: string[];                            // option values of the epic field
  linkTypes: string[];                        // link type keys
  transitionCount: number;                    // 0 = unrestricted workflow
  tickets: SummaryRow[];                      // unarchived TOP-LEVEL tickets only,
                                              // sorted by number; children appear
                                              // inside their parent's row
}
```

The summary row (shared with `search_tickets` and `get_ticket`):

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

## Behavior

- Calls [`GET /api/projects/:key/board`](../api/get-board.md) once and
  reshapes it — filtering archived vocabulary, collapsing fields to
  key/type/options, and summarizing tickets.

## Errors

Unknown project key surfaces the API's 404 message as `isError` text.

## Related

- [`search_tickets`](search-tickets.md) — filtered subset of these rows
- [`get_ticket`](get-ticket.md) — full detail for one row
