# Platform rethink — product direction

**Product / IA direction** for an item-centric app.  

**Current implementation work is narrower:** see [../rename/](../rename/README.md)  
(table rename `ticket*` → `item*`, app structure otherwise **unchanged**).

**Stack:** pnpm + turbo · Postgres · Drizzle · Fastify · React 19 · TanStack · MCP · Instrument UI · **`@tickets/*`**.

**Integrates with:** [../events/](../events/README.md) · [../fields/](../fields/README.md) · [../architecture/](../architecture/README.md)

## Locked for rename (see [../README.md](../README.md))

- Spine table: **`items`**  
- URLs: **full words** (`/items/`, `/views/`)  
- Packages: **`@tickets/*`**  
- MCP: **regenerate from API / shared ops**  
- Kinds (when events touched): **`item.*`**

## Reading order

| # | File |
| - | ---- |
| 1 | [1-vision-and-principles.md](1-vision-and-principles.md) |
| 2 | [2-domain.md](2-domain.md) |
| 3 | [3-user-journeys.md](3-user-journeys.md) |
| 4 | [4-information-architecture.md](4-information-architecture.md) |
| 5 | [5-database.md](5-database.md) |
| 6 | [6-api.md](6-api.md) |
| 7 | [7-web.md](7-web.md) |
| 8 | [8-mcp.md](8-mcp.md) |
| 9 | [9-events-and-automation.md](9-events-and-automation.md) |
| 10 | [10-repo-structure.md](10-repo-structure.md) |
| 11 | [11-build-plan.md](11-build-plan.md) |

## One-page picture

```
Web · MCP → HTTP → command/query registries → domain → event registry → Postgres
                                                      → outbox → consumers
```
