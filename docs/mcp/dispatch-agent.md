# dispatch_agent

**Write tool** — puts an agent persona on a ticket. Creates a child agent
session that works the ticket in its own git worktree and comments its result
back when done. This is how one agent hands a well-scoped piece of work to
another.

**Source:** [`apps/mcp/src/tools/dispatch-agent.ts`](../../apps/mcp/src/tools/dispatch-agent.ts)

## Input

```ts
{
  agentKey: string;       // key of the persona to dispatch (see the agent library)
  projectKey: string;
  ticketNumber: number;   // int
  prompt: string;         // non-empty — the task for the dispatched agent
}
```

## Output

JSON text:

```ts
{
  dispatched: true;
  agentKey: string;
  ticket: string;         // e.g. "TIX-153"
  sessionId: number;      // the child agent session
}
```

## Behavior

- Loads the [board](get-board.md) to resolve the ticket, looks the persona up by
  `agentKey` in `GET /api/ai/agents`, then calls `POST /api/ai/dispatch` with the
  resolved `agentId`, `ticketId`, `prompt`, and the configured actor.
- The API creates a child session (`parent_session_id` + `ticket_id` set), runs
  it in an isolated git worktree, records an `agent_dispatched` event on the
  ticket, and on completion comments a summary back.
- When this MCP server itself runs inside an agent session, `AI_SESSION_ID` in
  its environment becomes the child's `parent_session_id`, so the sessions list
  nests as a tree.

## Errors

Unknown project, ticket number, or `agentKey` returns `isError` text. The API
returns 429 once the concurrent-dispatch cap is reached.

## Related

- The dispatched run appears in the sessions tree and, once it finishes, as a
  comment in [`get_ticket`](get-ticket.md).
