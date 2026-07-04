# create_ticket

**Write tool** — attributed to the configured actor. Creates a ticket.
Required fields depend on the type (check [`get_board`](get-board.md));
status defaults to the project's initial one.

**Source:** [`apps/mcp/src/tools/create-ticket.ts`](../../apps/mcp/src/tools/create-ticket.ts)

## Input

```ts
{
  projectKey: string;
  typeKey: string;                  // e.g. "task" | "subtask"
  values: Record<string, unknown>;  // field key → value, e.g.
                                    // { title: "...", description: "markdown",
                                    //   severity: "high", epic: "..." }
  parentNumber?: number;            // int — create as a subtask under this ticket
}
```

## Output

JSON text:

```ts
{ created: true; ticketNumber: number }
```

## Behavior

- If `parentNumber` is given, loads the
  [board](../api/get-board.md) to resolve it to an internal id.
- Calls [`POST /api/projects/:key/tickets`](../api/create-ticket.md) with
  `actorId` set to the configured actor.

## Errors

`isError` text with the API's message: missing required field, unknown
field/option/status, depth-1 hierarchy violation, invalid starting status.

## Related

- [`update_ticket`](update-ticket.md) · [`get_board`](get-board.md) for the
  vocabulary of valid keys and values
