# update_ticket

**Write tool** — attributed to the configured actor. Updates field values
(`null` clears a field), moves the ticket under a parent (or detaches it),
or archives/unarchives it. **Concurrency is handled internally** — callers
never see the optimistic-lock plumbing.

**Source:** [`apps/mcp/src/tools/update-ticket.ts`](../../apps/mcp/src/tools/update-ticket.ts), retry logic in
[`apps/mcp/src/helpers/patch-ticket-with-retry.ts`](../../apps/mcp/src/helpers/patch-ticket-with-retry.ts)

## Input

```ts
{
  projectKey: string;
  ticketNumber: number;              // int
  values?: Record<string, unknown>;  // e.g. { status: "in-progress" } or { title: "..." };
                                     // null clears a field
  parentNumber?: number | null;      // move under a parent; null detaches
  archived?: boolean;
}
```

## Output

JSON text:

```ts
{
  updated: true;
  ticketNumber: number;
  updatedAt: string;
}
```

## Behavior

- Loads the [board](../api/get-board.md) to resolve the ticket (and parent)
  number and grab the fresh `updatedAt`, then calls
  [`PATCH /api/tickets/:id`](../api/update-ticket.md).
- On a `409` (someone moved the ticket between read and write) it refetches
  and retries **exactly once**; a second 409 surfaces as an error.

## Errors

`isError` text with the API's message — notably the `422` naming an illegal
status transition, e.g. `transition open → fixed is not in the workflow graph`.

## Related

- [`get_ticket`](get-ticket.md) to read before writing
- Ticket type is immutable — there is no way to change it here
