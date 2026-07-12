# Layer 3 — Runtime

_How it runs: the write path, the generic pipeline, projections, the one consumer bus, and ops. Tables
→ [`2-schema.md`](2-schema.md); shapes/registry → [`1-events.md`](1-events.md)._

---

## Write path

Every mutation is a **command** → validate → **N events** → project → outbox, in one transaction:

```
BEGIN
  1. INSERT commands(id=commandId)      → conflict → return cached result / no-op
  2. lock stream head                   → SELECT ticket FOR UPDATE (or seq allocator)
  3. validate command                   → field ∈ type, transitions, guards, cardinality
  4. build events[]                     → consecutive seq, shared correlationId, after-only
  5. for each event: parse → INSERT → project → INSERT outbox
  6. bump tickets.updated_at            (Tier 0/A)
COMMIT → return new state + etag
```

Validate cheap→expensive; take the stream lock only after cheap checks (parse, idempotency, authZ).

---

## Generic pipeline

Steps 5's inner loop is kind-agnostic — it reads the registry, so no per-kind branching lives here:

```ts
async function append<K extends EventKind>(tx, kind: K, payload: PayloadFor<K>, ctx) {
  const def = registry.defs[kind];
  v.parse(def.schema, payload);                                  // registry.parse — validate shape
  const e = { ...ctx.meta, kind, seq: ctx.nextSeq(), payload };
  const [{ id }] = await tx.insert(events).values(e).returning({ id: events.id });
  const stored = { ...e, id };
  await def.project?.(tx, stored);                               // registry.apply — fold state
  const row = def.activity?.(stored, ctx.prior);
  if (row) await tx.insert(ticketActivity).values(row);
  await tx.insert(outbox).values({ eventId: id });              // → consumers
}
```

Add a kind → it flows through `append` unchanged.

---

## Tier A vs B write

| | Tier 0 / A (state-first) | Tier B (event-first) |
| --- | --- | --- |
| Order | validate → **mutate tables** → append events (+ outbox) | validate against folded/projected state → append events → **project tables** |
| Source of truth | current tables | the `events` log |
| Requirement | events still **lossless** (so B is possible) | append + project in one txn (both or neither) |

Same code path; only step order flips. The rebuild job is for **reconciliation**, not the happy path.

---

## Concurrency

- **`seq`** — allocated under the ticket row lock (`MAX(seq)+1`, or a `stream_heads` side table for long
  streams). `unique(aggregate_type, aggregate_id, seq)` is the backstop; on conflict → retry the command once.
- **`updated_at`** — stays the HTTP-409 optimistic token through Tier 0/A (accept `expectedUpdatedAt`).
  Expose `seq` as an etag only at Tier B. Don't require both forever.
- **Assignment** — server: `seq`, `at`, `correlationId`. Client: `commandId` (so retries dedupe; the
  server may generate one, but then retries won't dedupe — document that).

---

## Batching / no-op / normalize

- **Multi-field** — one command, N events (multi-row INSERT), shared `correlationId`, consecutive `seq`.
- **No-op** — if `equal(current, after)` after normalize, skip that field's event.
- **Normalize** — `option`/`user` arrays → unique + sorted before compare and store.

---

## Projections

**`ticket_values`** — `apply` = delete the field's rows, insert the rows for `after`:

```ts
function toRows(ticketId, e /* FieldChanged */) {
  const { fieldId } = e;
  switch (e.type) {
    case 'string':  return e.value === null ? [] : [{ ticketId, fieldId, valueText: e.value }];
    case 'number':  return e.value === null ? [] : [{ ticketId, fieldId, valueNumber: e.value }];
    case 'boolean': return e.value === null ? [] : [{ ticketId, fieldId, valueBool: e.value }];
    case 'date':    return e.value === null ? [] : [{ ticketId, fieldId, valueDate: e.value }];
    case 'option':  return e.value.map((optionId) => ({ ticketId, fieldId, optionId }));
    case 'user':    return e.value.map((valueUserId) => ({ ticketId, fieldId, valueUserId }));
    case 'json':    return e.value == null ? [] : [{ ticketId, fieldId, valueJson: e.value }];
    default:        return assertNever(e);
  }
}
```

**`ticket_activity`** — source events carry only the new `value`, so the projector computes the diff:
folding in order it knows the prior value and writes `{ fieldId, before, after }` here (this row *is* a
diff, so before/after are the right names). The feed groups by `correlationId`. This is "how you see
ticket activity" now.

**Rebuild + verify** — projections are disposable; rebuild a ticket by folding its stream (from the
latest snapshot). CI rebuilds into a scratch DB and **diffs against live tables** — any drift is a
projector bug.

---

## Consumers — one bus

`outbox` is drained by a **single worker**, at-least-once. Everything hangs off it — no second queue.

```
txn: events + outbox
     │
     ▼   SELECT … FROM outbox JOIN events ORDER BY id FOR UPDATE SKIP LOCKED
 outbox worker ──► activity (if async) ──► automations ──► webhooks ──► search / metrics
```

**Consumer contract:**

```ts
type Consumer = {
  name: string;                                 // stable, unique
  match: (e: DomainEvent) => boolean;           // by kind prefix / tag
  handle: (e: DomainEvent, ctx: Ctx) => Promise<void>;  // must tolerate duplicates
};
```

Idempotency keys: `(consumer_name, event_id)` (generic), `(rule_id, event_id)` (automation),
`(subscription_id, event_id)` (webhook). Inline projections are strongly consistent; async consumers
are eventually consistent and idempotent.

---

## Automations

Owned by the automation-rules design; this platform supplies the durable stream + outbox + `causedBy` /
`depth` + an `agent`-kind actor. Automated writes **re-enter the command path** (new command + events),
never raw table updates. Cap `depth` (e.g. 5) to stop loops.

---

## Upcasters / snapshots / PII

- **Upcasters** — each kind's `upcast` map on its registry def; readers migrate on load, rows never rewritten.
- **Snapshots** — load the latest `ticket_snapshots` ≤ target `seq`, fold after it; take one every N events. Tier B seam; wire it early.
- **PII / crypto-shredding** — store comment bodies (+ PII text) encrypted under a per-subject key; GDPR-erase = drop the key. `{ "bodyEnc": "…", "keyId": "user:7" }`.

---

## Errors / metrics / failure modes

| Condition | Result |
| --- | --- |
| command replay | 200/201 with prior result |
| seq / updatedAt conflict | 409 (retry once) |
| validation / unknown kind | 400 |
| outbox worker down | writes still succeed; delivery lags |
| handler throws | row retried (SKIP LOCKED); poison → dead-letter + alert |

**Metrics:** outbox depth/lag, handle p50/p99 per consumer, retry/dead-letter counts, events/sec.

---

## Cross-refs

Envelope / kinds / registry → [`1-events.md`](1-events.md). Tables → [`2-schema.md`](2-schema.md).
Rollout → [`4-migration-plan.md`](4-migration-plan.md).
