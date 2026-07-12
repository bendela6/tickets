# Architecture — pipelines

## Routing (thin)

```ts
app.post('/api/projects/:key/items', (req) =>
  runCommand('item.create', { projectKey: req.params.key, ...req.body }, ctx(req)));
app.patch('/api/items/:id', (req) =>
  runCommand('item.patch', { id: req.params.id, ...req.body }, ctx(req)));
app.get('/api/items/:id', (req) =>
  runQuery('item.get', { id: req.params.id }, ctx(req)));
app.get('/api/projects/:key/board', (req) =>
  runQuery('board.list', { projectKey: req.params.key, ...req.query }, ctx(req)));
```

## Command registry

```ts
export const itemPatch = defineCommand({
  name: 'item.patch',
  input: ItemPatchSchema, // @tickets/core
  handle: async (tx, input, ctx) => {
    const effective = await loadEffectiveFields(tx, input.id);
    const events = validateItemPatch(effective, input, ctx); // pure
    await emitAll(tx, events, ctx); // event registry
    return loadItemDto(tx, input.id);
  },
});
```

## Write pipeline

```
runCommand:
  parse input
  BEGIN
    commands ledger (idempotency)
    lock aggregate
    def.handle → builds domain events
    for each: eventRegistry parse + insert + project + activity + outbox
    bump updated_at
  COMMIT
```

## Query registry

```ts
export const boardList = defineQuery({
  name: 'board.list',
  input: BoardListSchema,
  handle: (db, input) => readBoard(db, input),
});
```

Reads **projections / tables only** — no event fold on hot path (Tier A).

## Feature vertical slice example

Patch field value:

1. HTTP → `item.patch`  
2. Command validates via effective fields + transitions  
3. Emits `item.field_changed`  
4. Event def projects `item_values` + `item_activity`  
5. Outbox → automations  

New feature ≈ new command kind file + event kind file(s) + optional query.
