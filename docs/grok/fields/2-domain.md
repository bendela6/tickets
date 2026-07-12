# Fields — domain rules

## Load vocab

For a project → scheme →:

- field library map `fieldId → Field`
- per type: ordered `EffectiveField[]`
- options by fieldId

## Write validation

1. Field attached to item’s type  
2. Required on create/patch when empty  
3. Value shape matches field type  
4. Option ids belong to field; users exist  
5. If workflow field: transition allowed from current option → new  

## Detach rules (**locked: A**)

| Policy | Behavior |
| ------ | -------- |
| **A (locked)** | Block detach if any item of that type has a value for that field |
| B | Soft-detach; values remain readable but hidden in forms |
| C | Cascade clear values on detach |

## Workflow options per type (**open**)

Types may need **different status option subsets** and/or different transitions.  
Candidate models (not locked): separate status fields per type · one field + per-type allowlist · option “scopes” · type-local option clones. Decide before implementing workflow settings UI.

## Cross-type reporting

Board columns and filters reference **fieldId** (or stable key within scheme). One id across types.

## Events

Item stream: still `item.field_changed` with shared `fieldId`.  
Config: `field.*`, `type.field_attached` / `detached` — see [../events/4-catalog.md](../events/4-catalog.md).
