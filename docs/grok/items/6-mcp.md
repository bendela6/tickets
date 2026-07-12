# 6 — MCP layer

App: `apps/mcp`. Tools talk HTTP only; rename tools and params to **item**.

## Tool set

| Tool name | HTTP | Notes |
| --------- | ---- | ----- |
| `list_projects` | GET projects | unchanged |
| `get_board` | GET board | response `.items` |
| `get_item` | GET `/api/items/:id` | was get_ticket |
| `search_items` | board or search endpoint | was search_tickets |
| `create_item` | POST `…/items` | was create_ticket |
| `update_item` | PATCH `/api/items/:id` | was update_ticket |
| `add_comment` | POST comments | `itemId` |
| `link_items` | POST links | was link_tickets |
| `remove_link` | DELETE link | unchanged idea |
| `list_item_events` | GET events | was list_ticket_events |

## Tool input sketches

```ts
// create_item
{ projectKey: string; typeKey: string; parentId?: number; values: Record<string, unknown> }

// update_item
{ itemId: number; expectedUpdatedAt: string; values?: …; parentId?: …; archived?: boolean }

// get_item
{ itemId: number }

// link_items
{ sourceItemId: number; targetItemId: number; linkTypeKey: string }
```

## File layout

```text
apps/mcp/src/tools/
  create-item.ts
  update-item.ts
  get-item.ts
  search-items.ts
  list-item-events.ts
  link-items.ts
  …
  list-projects.ts
  get-board.ts
  add-comment.ts
  remove-link.ts
```

Helpers: `resolve-item.ts`, `summarize-item.ts` (was ticket helpers).

## Docs

`docs/mcp/*.md` rewritten to item tool names and payloads.

## Actor

MCP still uses configured agent user; patches send that `actorId`.
