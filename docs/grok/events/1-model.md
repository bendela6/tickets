# Events — model & registry

## Principles

1. **Facts, past tense** — `item.created`, not `createItem`.
2. **Lossless** — ids and raw values, not labels alone.
3. **Value-only** — field events carry `value` (not before/after); diffs live in `item_activity`.
4. **One fact per event** — multi-field save = N events + shared `correlationId`.
5. **One registration per kind** — `defineEvent` + `registry.register`.
6. **All item stream kinds use `item.*` prefix** (locked).

## Envelope (`EventMeta`)

```ts
type EventMeta = {
  // DB assigns id: bigserial
  aggregateType: 'item' | 'scheme' | 'type' | 'field' | 'option' | 'linkType' | 'project' | 'user' | 'view';
  aggregateId: number;
  seq: number;
  version: number;
  kind: string; // registry-validated
  actorId: number;
  at: string; // ISO-8601 server
  commandId: string; // uuid client → commands ledger
  correlationId: string; // default = commandId
  causedBy: number | null;
  depth: number;
  projectId: number | null; // required for item streams
};
```

## Item stream kinds

```
item.created · item.reparented · item.archived · item.unarchived
item.field_changed
item.comment_added · item.comment_edited · item.comment_deleted
item.reaction_added · item.reaction_removed
item.link_added · item.link_removed
item.imported   // optional baseline for Tier B
```

`aggregateType = 'item'`, `aggregateId = itemId`.

## Field types vs value types

**Field enum** (`fields.type`):  
`string · number · boolean · date · datetime · option · user · json`  
(+ `config`: format, multiple, markdown, transitions, …)

**Value types** in `item.field_changed`:

| type | `value` | → column |
| ---- | ------- | -------- |
| string | `string \| null` | value_text |
| number | `string \| null` | value_number |
| boolean | `boolean \| null` | value_bool |
| date | ISO string \| null | value_date |
| option | `number[]` sorted unique | option_id rows |
| user | `number[]` sorted unique | value_user_id rows |
| json | unknown | value_json |

**No `status` type.** Workflow field is `option` + `config.transitions`; option `config.kind` = todo/active/done/….

## `item.field_changed` schema

```ts
export const ItemFieldChangedSchema = v.variant('type', [
  v.object({ fieldId: v.number(), type: v.literal('string'), value: v.nullable(v.string()) }),
  v.object({ fieldId: v.number(), type: v.literal('number'), value: v.nullable(v.string()) }),
  v.object({ fieldId: v.number(), type: v.literal('boolean'), value: v.nullable(v.boolean()) }),
  v.object({ fieldId: v.number(), type: v.literal('date'), value: v.nullable(v.string()) }),
  v.object({ fieldId: v.number(), type: v.literal('option'), value: v.array(v.number()) }),
  v.object({ fieldId: v.number(), type: v.literal('user'), value: v.array(v.number()) }),
  v.object({ fieldId: v.number(), type: v.literal('json'), value: v.unknown() }),
]);
```

## Structural payloads (item)

| kind | payload |
| ---- | ------- |
| `item.created` | `{ projectId, typeId, number, parentId }` |
| `item.reparented` | `{ from, to }` (`number \| null`) |
| `item.archived` / `unarchived` | `{}` |
| `item.comment_added` / `edited` | `{ commentId, body, parentId? }` |
| `item.comment_deleted` | `{ commentId }` |
| `item.reaction_*` | `{ commentId, emoji }` |
| `item.link_added` | both streams: `{ linkId, linkTypeId, linkTypeKey?, sourceItemId, targetItemId }` |
| `item.link_removed` | both streams: `{ linkId }` |

## Registry

```ts
type EventDef<K extends string, S extends v.GenericSchema> = {
  kind: K;
  schema: S;
  project?: (tx, e) => Promise<void>;
  activity?: (e, prior) => ActivitySummary | null;
  upcast?: Record<number, (p: unknown) => unknown>;
  tags?: readonly string[];
};

export const itemFieldChanged = defineEvent({
  kind: 'item.field_changed',
  schema: ItemFieldChangedSchema,
  project: projectFieldChanged,
  activity: (e, prior) => ({
    fieldId: e.payload.fieldId,
    before: readField(prior, e.payload.fieldId),
    after: e.payload.value, // activity row uses before/after; event uses value
  }),
  tags: ['item', 'field'],
});

eventRegistry.register(itemFieldChanged);
```

**Add kind:** one def file + register (or chain). Pipeline never switches on kind.

Schemas/types for payloads live in **`@tickets/core`** so api/web/mcp share them.

## Multi-field

One command → N `item.field_changed` + shared `correlationId` + consecutive `seq`.  
Normalize option/user sets; skip no-ops when `value` equals current.
