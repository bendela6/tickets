# Architecture — registries & pipelines

**Future direction** (command/query registries). **Not** required for the [ticket→item rename](../rename/README.md); current API route modules can stay until a later pass.

Integrates **platform** product shape with **events** + **fields**.

| # | File |
| - | ---- |
| 1 | [1-file-structure.md](1-file-structure.md) |
| 2 | [2-pipeline.md](2-pipeline.md) |

## One idea

> **Commands, queries, and events are registries of self-contained defs.**  
> HTTP is a thin map to names. Adding a feature = new def files, not central switches.

```
HTTP → command registry | query registry
         ↓ write
       domain (vocab, transitions, invariants)
         ↓
       event registry → store + project + outbox
         ↓
       consumers
```

## Builds on

- [../platform/](../platform/README.md) — product, routes, slices  
- [../events/](../events/README.md) — event model  
- [../fields/](../fields/README.md) — reusable fields  
