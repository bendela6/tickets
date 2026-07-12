# MCP stays in sync with API (and events)

## Goal

Changing something in the API (routes, DTOs, event kinds used by tools) should **update MCP** without a second full hand rewrite. Prefer **regenerate / rebuild**, not dual maintenance.

## Target model

```text
                    ┌─────────────────────┐
                    │  @tickets/core      │
                    │  or api manifest    │
                    │  operations[]       │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         apps/api         apps/mcp         docs/mcp
         handlers         tool wrappers    markdown
```

Each **operation** (e.g. `item.create`, `item.patch`, `item.get`, `item.listEvents`) declares:

- name  
- input schema (valibot/zod)  
- HTTP method + path (for MCP HTTP client)  
- optional: related **event kinds** emitted (for docs / agent hints)  
- MCP: tool description, enabled flag  

## Practical options (pick one when implementing)

| Approach | How | Pros | Cons |
| -------- | --- | ---- | ---- |
| **A. Shared ops in `@tickets/core`** | Define ops once; api registers handlers by name; mcp generates tools from same list | True single source | Needs core package + discipline |
| **B. Codegen from API route table** | Script scans `routes.ts` or OpenAPI → writes `apps/mcp/src/tools.generated.ts` | Fits “routes stay as today” | Parser/OpenAPI must stay accurate |
| **C. Build-time export** | api package exports `operations` manifest; mcp imports it | No OpenAPI | Couples mcp build to api package |
| **D. CI drift check only** | Hand tools + test that every MCP tool path exists on api | Low investment | Still hand-edit tools; CI fails on miss |

**Recommendation for rename pass:** start with **D** (CI check) so rename finishes fast; move to **A or B** so “modify API → rebuild MCP” is real.

## Events

MCP tools that care about history (`list_item_events`) should document/filter **`item.*`** kinds from the same catalog as the API ([../events/4-catalog.md](../events/4-catalog.md) when event work lands).

If tools are generated from ops:

```ts
{
  name: 'item.patch',
  http: { method: 'PATCH', path: '/api/items/:id' },
  emits: ['item.field_changed', 'item.reparented', 'item.archived', …],
}
```

Agent-facing tool description can list `emits` automatically.

## Rebuild commands (illustrative)

```bash
pnpm --filter @tickets/mcp codegen   # regenerate tools from manifest
pnpm --filter @tickets/mcp test      # drift + smoke
```

Or turbo pipeline: `api#manifest` → `mcp#codegen`.

## Rules

1. **No long-lived fork** of request shapes between web, api, and mcp.  
2. Rename of `ticket*` → `item*` updates the **manifest once**, then regenerate mcp.  
3. Do not hand-edit generated files; edit source of generation.
