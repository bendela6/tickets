# Fields — API surface

Commands (names illustrative; registered in architecture):

| Command | Purpose |
| ------- | ------- |
| `field.define` | create library field on scheme |
| `field.update` / `field.archive` | library edits |
| `option.add` / `update` / `archive` | options |
| `type.attachField` | join row position/required/override |
| `type.detachField` | remove join (policy A) |
| `type.updateFieldPlacement` | reorder / required / override |

Queries:

| Query | Purpose |
| ----- | ------- |
| `field.library` | scheme fields + options |
| `type.effectiveFields` | merged list for forms |
| `structure.get` | board/settings bundle |

HTTP thin map examples:

```
POST   /api/schemes/:id/fields
POST   /api/item-types/:id/fields          # attach body: { fieldId, position, required }
DELETE /api/item-types/:id/fields/:fieldId
PATCH  /api/fields/:id
```

Item writes use effective fields from type; values keyed by `fieldId`.
