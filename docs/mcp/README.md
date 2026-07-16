# MCP tool reference

Stdio MCP server in [`apps/mcp`](../../apps/mcp/src/) that lets any Claude
session read and write the tracker. It talks **only to the HTTP API**
(never the database) and resolves `TICKETS_ACTOR` (default `claude`) to a
user at startup — every write is attributed to that user in the audit
trail. Tools address tickets by **project key + ticket number**, never
internal ids.

## Conventions

- Results are JSON pretty-printed into a single text content block.
- Failures come back as readable `isError` text results
  (`Error: <message>`, e.g. the API's validation message) — not protocol
  errors.
- Environment: `TICKETS_API_URL` (default `http://127.0.0.1:4600`),
  `TICKETS_ACTOR` (default `claude`, auto-created as an `agent` user).

## Tools

| Tool | Kind | Description |
| ---- | ---- | ----------- |
| [`list_projects`](list-projects.md) | read | All projects (key, name, ticket prefix) — start here when the project key is unknown |
| [`get_board`](get-board.md) | read | Project orientation: vocabulary plus one token-lean summary row per top-level ticket |
| [`get_ticket`](get-ticket.md) | read | Everything about one ticket: values, markdown description, comments, links, children, recent events |
| [`search_tickets`](search-tickets.md) | read | Filter tickets by free-text query, status kinds, statuses, epic, or type |
| [`list_ticket_events`](list-ticket-events.md) | read | One ticket's audit trail, newest first |
| [`create_ticket`](create-ticket.md) | write | Create a ticket; required fields depend on the type, status defaults to the initial one |
| [`update_ticket`](update-ticket.md) | write | Update values / parent / archived; optimistic-lock retry handled internally |
| [`add_comment`](add-comment.md) | write | Add a markdown comment |
| [`link_tickets`](link-tickets.md) | write | Relate two tickets ("source *linkType* target") |
| [`remove_link`](remove-link.md) | write | Remove an existing relation |
| [`dispatch_agent`](dispatch-agent.md) | write | Put an agent persona on a ticket — runs it in an isolated worktree, comments the result back |

## Registration

```sh
claude mcp add tickets --scope user -- node <repo>/apps/mcp/node_modules/tsx/dist/cli.mjs <repo>/apps/mcp/src/server.ts
```
