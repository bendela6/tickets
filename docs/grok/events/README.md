# Events — design set

Typed, lossless, consumable log for the **item** aggregate (+ optional audit streams).

| # | File | Owns |
| - | ---- | ---- |
| 1 | [1-model.md](1-model.md) | envelope, kinds, value types, registry |
| 2 | [2-schema.md](2-schema.md) | `events`, `commands`, outbox, activity, values |
| 3 | [3-runtime.md](3-runtime.md) | write path, projections, consumers |
| 4 | [4-catalog.md](4-catalog.md) | every kind + payload |
| 5 | [5-phases.md](5-phases.md) | greenfield delivery phases (not legacy migration) |

## Goal

Tier **0 → A** (default): tables remain SoT; events are lossless + drive activity/automations.  
Tier **B** (gated): item log becomes SoT; projections rebuildable.

## Non-goals

- Event-source config/views/users as SoT  
- Plural multi-field event  
- Separate statuses tables  
- Dual ticket/item naming  
