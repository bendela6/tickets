# list_projects

**Read tool.** Lists all ticket projects. Start here when you don't know
the project key.

**Source:** [`apps/mcp/src/tools/list-projects.ts`](../../apps/mcp/src/tools/list-projects.ts)

## Input

None.

## Output

JSON text:

```ts
{
  key: string;           // pass this to every other tool
  name: string;
  ticketPrefix: string;  // e.g. "TASK" in TASK-42
}[]
```

## Behavior

- Calls [`GET /api/projects`](../api/list-projects.md) and strips the rows
  down to the three fields above.

## Errors

API/network failures return `isError` text (`Error: <message>`).

## Related

- [`get_board`](get-board.md) — the usual next call
