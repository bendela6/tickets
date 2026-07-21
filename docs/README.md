# Documentation

| Section | What's in it |
| ------- | ------------ |
| [HTTP API reference](api/README.md) | Flat list of every endpoint — one detail page each with request/response types, error codes, and the DB tables touched |
| [MCP tool reference](mcp/README.md) | Flat list of every MCP tool — one detail page each with input/output shapes and the HTTP calls behind them |
| [Database tables](database.md) | Every Postgres table with its purpose and key constraints |
| [Schema admin](schema-admin.md) | The config commands that edit scheme structure (types, placements, link-type vocabulary) — routes and archive-vs-replace semantics |
| [Grok design SSOT](grok/README.md) | **Now:** [ticket→item rename](grok/rename/README.md); also platform/events/fields direction |
| [Signals SDK](signals-sdk.md) | Consumer guide for `@bendela6/signals-*` — install, React/Node/plain-HTML quickstarts, source maps, publishing |

The architecture rationale (why fields are data, EAV trade-offs, workflow graph
semantics) lives in [DESIGN.md](../DESIGN.md).
