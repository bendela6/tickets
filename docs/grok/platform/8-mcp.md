# 8 — MCP (agents)

## Role

Same capabilities as a power user, via tools. **No DB access.** HTTP (or generated client) to the API.

## Sync with API / events (locked)

MCP must **not** be a second hand-written API. Operations and event kind hints come from a **shared source**; MCP **regenerates/rebuilds** when API changes.

Details: [../rename/mcp-sync.md](../rename/mcp-sync.md).

## Tools (after ticket→item rename)

| Tool | HTTP (illustrative) |
| ---- | ------------------- |
| `list_projects` | GET `/api/projects` |
| `get_board` / `search_items` | GET board / items |
| `get_item` | GET `/api/items/:id` |
| `create_item` | POST `…/items` |
| `update_item` | PATCH `/api/items/:id` |
| `list_item_events` | GET `…/events` (`item.*` kinds) |
| `add_comment` | POST comments |
| `link_items` / `remove_link` | links |

Same behavior as today’s ticket tools; names/params use **item**.

## Layout

Keep current mcp structure; rename tool files; add `codegen` when ready.

## Contracts

- `projectKey`, `itemId`, `typeKey`, `values`
- Errors: surface API status (e.g. 409 → re-get item)
- Event-related tools align with `item.*` catalog
