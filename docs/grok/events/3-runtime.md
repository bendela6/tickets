# Events — runtime

## Write path (with command registry)

Commands decide **which** events; event registry **appends / projects / outboxes**.

```
runCommand(name, body, ctx):
  input = v.parse(commandDef.input, body)
  BEGIN
    INSERT commands(id) → conflict → return cached
    lock item row; check expectedUpdatedAt (Tier A)
    load vocab (effective fields) + state
    events[] = domain validate + build (pure)
    for each event:
      v.parse(eventDef.schema, payload)
      INSERT events (seq++, correlationId, commandId)
      eventDef.project?(tx, stored)      // item_values, …
      activity ← eventDef.activity? → INSERT item_activity
      INSERT outbox
    bump items.updated_at
  COMMIT
  return DTO + etag
```

See [../architecture/2-pipeline.md](../architecture/2-pipeline.md).

## Tier A vs B

| | Tier A (default) | Tier B (gated) |
| --- | --- | --- |
| Order | mutate tables → append events | append events → project tables |
| SoT | tables | events log |
| HTTP lock | `updated_at` | optional `seq` etag |

## Concurrency

- `seq` under item `FOR UPDATE`; unique `(aggregate_type, aggregate_id, seq)`
- Client: `commandId`; server: `seq`, `at`, `correlationId` (default = commandId)

## Batching / no-op / normalize

- Multi-field: N events, one correlation, multi-row insert
- Skip when normalized `value` equals current
- option/user: unique + sort

## Projections

| Projection | How |
| ---------- | --- |
| `item_values` | replace rows for field from `value` |
| `item_activity` | inline; summary before/after for UI |
| Snapshots | Tier B |

## Consumers

One outbox worker → automations, webhooks, indexers.  
Idempotent on `(consumer, event_id)`. Prefer `eventRegistry.kindsWithTag`.  
Automations re-enter **commands** with `causedBy` / `depth++`.

## Ops

Metrics: outbox lag, append rate, handler p99.  
PII (later): crypto-shred comment bodies.  
Poison: dead letter after N retries.
