# 4 — Events layer (item aggregate)

Aligns with [../1-events.md](../1-events.md) and [../5-event-catalog.md](../5-event-catalog.md), but **kinds use `item.*`**.

## Stream

| Field | Value |
| ----- | ----- |
| `aggregateType` | `'item'` |
| `aggregateId` | `items.id` |
| `projectId` | denormalized from item |

## Kind catalog (records)

| Kind | Payload |
| ---- | ------- |
| `item.created` | `{ projectId, typeId, number, parentId }` |
| `item.reparented` | `{ from, to }` |
| `item.archived` / `item.unarchived` | `{}` |
| `item.field_changed` | `{ fieldId, type, value }` (value-only; see value types) |
| `item.comment_added` | `{ commentId, body, parentId }` |
| `item.comment_edited` | `{ commentId, body }` |
| `item.comment_deleted` | `{ commentId }` |
| `item.reaction_added` / `removed` | `{ commentId, emoji }` |
| `item.link_added` | both item streams: `{ linkId, linkTypeId, linkTypeKey?, sourceItemId, targetItemId }` |
| `item.link_removed` | both streams: `{ linkId }` |
| `item.imported` | baseline snapshot if needed for ES later |

## Field value payload

```ts
// item.field_changed
{
  fieldId: number;
  type: 'string' | 'number' | 'boolean' | 'date' | 'option' | 'user' | 'json';
  value: /* shape by type — not named after/before */
}
```

## Registry layout

```text
apps/api/src/events/
  registry.ts
  defs/
    item-created.ts
    item-field-changed.ts
    item-reparented.ts
    …
  index.ts   # side-effect register all defs
```

```ts
export const itemFieldChanged = defineEvent({
  kind: 'item.field_changed',
  schema: fieldChangedSchema,
  project: async (tx, e) => { /* item_values */ },
  activity: (e, prior) => ({
    fieldId: e.payload.fieldId,
    before: readField(prior, e.payload.fieldId),
    after: e.payload.value,
  }),
  tags: ['item', 'field'],
});
eventRegistry.register(itemFieldChanged);
```

## Write path (conceptual)

Same as event-platform runtime, with tables renamed:

1. `commands` ledger  
2. lock **item** row  
3. validate  
4. mutate `items` / `item_values` / … (Tier A)  
5. append `item.*` events  
6. activity + outbox  

## Config / workspace events

Unchanged idea (`field.created`, `project.created`, …). Config `field.*` does not collide with `item.field_changed`.

## Activity API

`GET /api/items/:id/events` reads `item_activity` or `events` where `aggregate_type = 'item'`.

## Mapping from old names (reference only)

| Old kind | New kind |
| -------- | -------- |
| `created` | `item.created` |
| `value-changed` / `status-changed` | `item.field_changed` |
| `parent-changed` | `item.reparented` |
| `commented` | `item.comment_added` |
| `link-added` | `item.link_added` |
