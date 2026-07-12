# Reusable fields

Scheme-scoped **field library** composed into types via M2M. Clean target (greenfield).

| # | File |
| - | ---- |
| 1 | [1-data-model.md](1-data-model.md) |
| 2 | [2-domain.md](2-domain.md) |
| 3 | [3-api.md](3-api.md) |

## Principle

| Layer | Owns | Shared? |
| ----- | ---- | ------- |
| **Definition** `fields` + `field_options` | key, label, type, options, base config | one per scheme |
| **Placement** `item_type_fields` | position, required, `configOverride` | per (type, field) |
| **Effective field** | definition ⊕ placement | what reads/writes use |

Items store values by **shared `fieldId`**.

## Why

- One Priority / Assignee / Status field reused across types  
- Cross-type filters use one id  
- Per-type order/required/workflow override without forking options  

## Non-goals

- Global fields across schemes (clone scheme copies library)  
- Separate statuses tables  
