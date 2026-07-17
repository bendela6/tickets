# Items Platform — SP3: Event Runtime (outbox worker, activity feed, automations)

**Status:** design of record for sub-project 3 of the items-platform rebuild.
**Branch base:** `items-platform` @ `8fdc3ec` (SP1 + SP2 complete).
**Predecessors:** SP1 (22-table schema + import), SP2 (API command path, typed event
registry, `/api/items` routes — every mutation writes `events` + one `outbox` row in-txn).
**Successor:** SP4 (web + MCP + production cutover).

## 1. Goal

Give the append-only event log a runtime. SP2 populated `outbox` in the same
transaction as every event but nothing drains it, and `item_activity` is an empty
table. SP3 adds:

1. an **in-process outbox worker** that drains pending rows exactly-once-effectively,
2. an **`item_activity` projection** + a queryable **activity feed**, and
3. a **code-defined automation engine** (`defineAutomation`) with three real rules,

so the app can react to its own events without any human in the loop.

## 2. Scope

**In scope:** the outbox worker; the `item_activity` projection and two feed
endpoints; the `defineAutomation` registry, its dispatch integration in the worker,
and three shipping rules; the schema additions those need (`outbox.attempts`,
`outbox.last_error`, and the `events` project CHECK); envelope changes to thread
`caused_by`/`depth`; and the runtime-correctness follow-ups deferred from SP2
(N3, M3, M4, N4, M1, M2, C2).

**Out of scope:** a data-defined `automations` table / rule-management UI (a future
sub-project if wanted); web and MCP (SP4); the production cutover (SP4); the SP2 link
**creation** regressions R1–R4 (SP4); LISTEN/NOTIFY and multi-worker partitioning
(the design stays correct for them but SP3 ships the single in-process loop).

## 3. Locked decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | **One SP3 spec covers worker + projection + automations.** | One end-to-end integration story: an event flows outbox → projection → automation → new command, tested as a whole. |
| 2 | **Worker is an in-process background loop** in the API node process, claiming with `FOR UPDATE SKIP LOCKED`. | Smallest deployable surface at this scale; the SKIP LOCKED claim keeps the code correct if a second instance ever runs, so nothing is thrown away by choosing simple now. |
| 3 | **Automations are code-defined** via `defineAutomation({ id, on, when, run })`. | Symmetric with the `defineCommand`/`defineEvent`/`runCommand` core; fully type-checked and testable; no new tables. |
| 4 | **Ship all three rules** (parent roll-up, auto-assign on start, blocked-link flag). | Broad coverage of the engine: single-aggregate, cross-aggregate/sibling read, and link traversal. |
| 5 | **All three rules trigger on `item.field_changed` for the workflow field**, keyed off the target option's `kind` (`options.kind` ∈ `todo · active · blocked · done · dropped`), not a new `status_changed` event. "Resolved" = `done` or `dropped`; "started" = `active`. | SP2 already emits `field_changed`; a `when` predicate reading option `kind` avoids a redundant event kind. |
| 6 | **Automation-emitted commands are idempotent by construction:** `commandId = uuidv5(NAMESPACE, "${sourceEventId}:${automationId}:${targetKey}")`. | At-least-once delivery + deterministic id ⇒ a re-drained event is deduped by the `commands` ledger. No effect fires twice. |
| 7 | **Automations run as a dedicated seeded `automation` system user** (`SYSTEM_ACTOR_ID`); rule logic may still read the *source* event's `actorId` for payloads (e.g. auto-assign). | Activity attribution is unambiguous ("automation did this"); auto-assign still assigns the human who triggered it. |
| 8 | **Loop-prevention by `depth`:** chained commands carry `caused_by = sourceEventId` and `depth = sourceEvent.depth + 1`; the worker skips automation dispatch (still projects) when `sourceEvent.depth ≥ DEPTH_CAP` (8). | A rule whose command re-triggers the same rule (parent roll-up → grandparent roll-up up a deep tree) cannot run away. |
| 9 | **Poison events use a lease + attempt cap,** not a dead-letter table: `outbox.attempts` + `outbox.last_error`, claim excludes `attempts ≥ 5`. | Failed events stay visible and stop blocking the head of the line without new infrastructure. |

## 4. Architecture

```
route / MCP ─► runCommand ─(one txn)─► events + outbox rows        [SP2, done]
                                            │  committed
                     ┌──────────────────────▼───────────────────────┐
                     │  OutboxWorker  (in-process loop)              │
                     │  claim: lease + FOR UPDATE SKIP LOCKED,       │
                     │         ORDER BY event_id, attempts < cap     │
                     │                                               │
                     │  per event, in order:                        │
                     │    1. project   → item_activity  (idempotent)│
                     │    2. automations → runCommand(chained env)  │
                     │  then set done_at                            │
                     └──────────────────────────────────────────────┘
```

Both consumers run **after** the source transaction commits, reading committed events.
Delivery is **at-least-once**: a crash between dispatch and `done_at` re-processes the
event, and both consumers are idempotent (projection by `unique(event_id)`, automations
by deterministic `commandId`), so re-processing is a no-op.

### 4.1 Worker loop and claim

The loop wakes on a `~500 ms` timer **or** an in-process nudge (`notifyOutbox()`, called
by the HTTP layer after a successful command so the common path has near-zero latency).
On each wake it drains until a claim returns zero rows, then sleeps.

Claim is a single atomic statement that leases a batch:

```sql
UPDATE outbox
   SET picked_at = now(), attempts = attempts + 1
 WHERE event_id IN (
   SELECT event_id FROM outbox
    WHERE done_at IS NULL
      AND attempts < 5
      AND (picked_at IS NULL OR picked_at < now() - interval '30 seconds')
    ORDER BY event_id
    FOR UPDATE SKIP LOCKED
    LIMIT 50)
RETURNING event_id;
```

`ORDER BY event_id` preserves per-stream order (`events.id` is monotonic per insert).
The 30 s lease makes an abandoned claim (crashed worker) re-eligible; the attempt cap
retires a genuinely poison row after 5 tries, leaving it `done_at IS NULL, attempts = 5`
— visible for inspection, excluded from future claims, blocking nothing.

Each claimed event is processed in its **own** short transaction path (projection txn,
then automation `runCommand` txns), never inside the claim's lock — the claim commits
immediately so `runCommand`'s own `db.transaction` never nests.

### 4.2 Projection → `item_activity`

For each foldable event (`aggregate_type = 'item'`, `version ≥ 1`; legacy `version 0`
rows are display-only and skipped) the projector inserts one `item_activity` row with
`onConflictDoNothing()` on the `item_activity_event` unique index:

- `kind` — the event kind (`item.created`, `item.field_changed`, `item.commented`, `item.linked`).
- `summary` (jsonb) — a rendered, self-contained diff computed with SP2's
  `renderValue`: `created → {typeKey, title}`; `field_changed → {field, from, to}`
  with option/user labels resolved; `commented → {excerpt}`; `linked → {linkType, targetId}`.
- `item_id`, `project_id`, `actor_id`, `at`, `correlation_id` copied from the event.

Because the insert is idempotent, re-draining an event never duplicates a feed row.

### 4.3 Activity feed endpoints

- `GET /api/items/:id/activity` → the item's `item_activity` rows, `ORDER BY at, id`.
- `GET /api/projects/:id/activity` → the project stream via the `events_project_at`
  index, same shape, paginated by `(at, id)`.

Both return `ActivityEntry` (see Types).

### 4.4 Automation engine

`defineAutomation({ id, on, when, run })` registers a rule (see Types). The worker,
after projecting an event and if `sourceEvent.depth < DEPTH_CAP`, looks up rules whose
`on` includes the event kind, evaluates `when(event, tx)`, and for a match calls
`run(event, ctx)`. `ctx.dispatch(command, input, key?)` invokes `runCommand` with a
**chained envelope**:

```
commandId      = uuidv5(AUTOMATION_NS, `${event.id}:${automation.id}:${key ?? ''}`)
actorId        = SYSTEM_ACTOR_ID
correlationId  = event.correlationId
causedBy       = event.id
depth          = event.depth + 1
```

`key` disambiguates when one rule dispatches several commands (rule 3 flags N targets),
keeping each dispatch's id deterministic and distinct. A dispatch whose `commandId`
already exists in the `commands` ledger returns the stored result — the re-drain no-op.

**Envelope/writeEvent changes.** `CommandEnvelope` gains optional `causedBy?: number`
and `depth?: number`. `runCommand` passes them through `CommandContext`; `writeEvent`
reads `ctx.envelope.causedBy ?? null` and `ctx.envelope.depth ?? 0` instead of the
current hardcoded `depth: 0` / unset `caused_by`. Human-originated commands omit both
and behave exactly as today (`depth 0`, `caused_by null`).

### 4.5 The three rules

All match `item.field_changed` where `payload.field` is the type's workflow field; the
`when` predicate resolves the target option's `kind` via the loaded vocab. "Resolved"
means `kind ∈ {done, dropped}`; "started" means `kind = active`.

1. **`parent-rollup`** — target option is resolved. Load the item's parent
   (`items.parentId`); if a parent exists and is not itself resolved, load all children;
   if every child's workflow value is now resolved, `dispatch(itemUpdate, { itemId: parentId,
   values: { <workflow>: <parent's first `done` option> } }, key = 'parent')`.
2. **`auto-assign-on-start`** — target option `kind = active` and the item's assignee
   (`value_user_id` on the assignee field) is empty: `dispatch(itemUpdate,
   { itemId, values: { assignee: event.actorId } }, key = 'assign')`.
3. **`blocked-link-flag`** — the change *leaves* resolved (was `done`/`dropped`, now not):
   find links where this item is the `blocks` source; for each target,
   `dispatch(itemComment, { itemId: targetId, body: '<blocker> was reopened' },
   key = String(targetId))`. Reads links only — no link creation, so untouched by R1–R4.

`DEPTH_CAP = 8` bounds any deep chain (e.g. roll-up climbing an 8-deep parent tree) and
any accidental cycle.

## 5. Schema changes (model is the source of truth)

Edit `apps/eer/models/items-platform.json` first, then the drizzle schema, then
regenerate; `packages/db/src/schema/model-conformance.test.ts` must stay green in both
directions.

- **`outbox.attempts`** `int NOT NULL DEFAULT 0`, **`outbox.last_error`** `text NULL`.
- **`events`** table CHECK: `aggregate_type <> 'item' OR project_id IS NOT NULL`
  (SP2 already populates `project_id`; this enforces it for future partitioned draining).

## 6. Folded-in SP2 follow-ups

Runtime-correctness items from `2026-07-15-sp2-deferred-followups.md` land here:

- **N3** — seq-collision (`events_stream_seq`) surfaces as 500. Add a bounded
  serialization retry in `runCommand`: on a `23505` whose constraint is `events_stream_seq`,
  retry the whole command up to 3 times, then map to 409. Needed now that automations and
  concurrent comments/links chain onto the same streams.
- **M3** — `item.update` skips the delete+reinsert **and** the `item.field_changed`
  emit when a field's value is unchanged (a workflow no-op no longer writes an event).
- **M4** — `assemble-items` adds `orderBy(itemValues.id)` so multi-value arrays are
  deterministic (the projection renders these).
- **N4** — `item.field_changed.from`/`to` render scalar-vs-array consistently for a
  single-valued multi field; a duplicate option value in a multi array is rejected 400,
  not left to a raw 23505.
- **M1 / M2** — `buildValueRows` rejects non-finite numbers (`Number.isFinite`) and
  non-strict-ISO date/datetime strings with a clean 400.
- **C2** — seed a few `option_transitions` and test both a disallowed move (422) and a
  guard block; the automation tests exercise transitions anyway.

Still deferred to SP4/later: M5, M6, C1, C3, and the link-creation regressions R1–R4.

## 7. Testing

Against the dedicated **`tickets_test`** DB (SP2 harness: vitest `setupFiles` forces
`POSTGRES_DATABASE`, `fileParallelism:false`). Production `tickets`, dev `tickets_dev`,
and the SP1 deliverable `tickets_platform` are never touched by tests.

- **Worker** — claims pending rows in `event_id` order and sets `done_at`; a lease
  expiry re-claims an abandoned row; at-least-once re-drain leaves projection and
  automations unchanged; a handler that always throws stops at `attempts = 5` and is
  excluded from further claims.
- **Projection** — each event kind folds to the right `kind` + `summary`; re-draining
  the same event inserts no duplicate (`onConflictDoNothing`). Feed endpoints return
  entries in `at, id` order.
- **Automations** — each rule end-to-end: issue the triggering command, run the worker,
  assert the resulting state **and** the chained event's `caused_by`, `correlation_id`,
  and `depth`. Plus: the deterministic-`commandId` idempotency test (re-drain ⇒ ledger
  hit, no second effect) and the `DEPTH_CAP` cutoff test.
- **Folded-in regressions** — N3 (concurrent same-stream commands: one retries/409s, no
  500), M3 (no-op update emits nothing), M4 (stable array order).

## 8. Deferrals

| Deferred | To |
|----------|-----|
| Data-defined `automations` table + rule-management API/UI | future sub-project |
| LISTEN/NOTIFY, multi-worker per-project partitioning | when scale demands it (design already compatible) |
| Dead-letter table / replay tooling | if poison volume warrants |
| SP2 link-creation regressions R1–R4; M5, M6, C1, C3 | SP4 |

## Types

```ts
// apps/api/src/event/registry.ts (existing) — the persisted event, folded/read here.
interface StoredEvent {
  id: number;
  aggregateType: string;
  aggregateId: number;
  seq: number;
  kind: string;
  version: number;              // 0 = legacy import, never folded
  payload: unknown;             // valibot-validated per kind
  actorId: number;
  at: string;                   // ISO timestamptz
  commandId: string;            // uuid
  correlationId: string;        // uuid
  causedBy: number | null;      // parent event id in a chain
  depth: number;                // 0 for human-originated
  projectId: number | null;     // non-null for item events (CHECK, §5)
}

// apps/api/src/command/envelope.ts (extended in SP3)
interface CommandEnvelope {
  commandId: string;            // uuid
  actorId: number;
  correlationId?: string;       // defaults to commandId
  causedBy?: number;            // SP3: set by automation dispatch
  depth?: number;               // SP3: set by automation dispatch, default 0
}

// apps/api/src/automation/registry.ts (new)
interface AutomationContext {
  // invokes runCommand with the chained envelope (§4.4); key disambiguates
  // multiple dispatches from one rule so each commandId stays deterministic.
  dispatch<S extends GenericSchema, R>(
    command: CommandDef<S, R>,
    input: InferOutput<S>,
    key?: string,
  ): Promise<R>;
}

interface AutomationDef {
  id: string;                                        // stable; part of the commandId hash
  on: string[];                                      // event kinds it reacts to
  when: (event: StoredEvent, tx: DbExecutor) => Promise<boolean>;
  run: (event: StoredEvent, ctx: AutomationContext) => Promise<void>;
}

function defineAutomation(def: AutomationDef): AutomationDef;
function automationsFor(eventKind: string): AutomationDef[];

// apps/api/src/outbox/worker.ts (new)
interface OutboxWorker {
  start(): void;                // begins the poll loop
  stop(): Promise<void>;        // stops after the in-flight batch
  drainOnce(): Promise<number>; // claim+dispatch one batch; returns rows processed (tests)
}
function notifyOutbox(): void;  // in-process nudge, called after a successful command

// apps/api/src/read/activity.ts (new) — feed row shape returned by both endpoints
interface ActivityEntry {
  id: number;
  itemId: number;
  eventId: number;
  kind: string;
  actorId: number;
  at: string;                   // ISO timestamptz
  correlationId: string;
  summary: Record<string, unknown>;  // rendered per event kind (§4.2)
}

// Constants
const DEPTH_CAP = 8;
const SYSTEM_ACTOR_ID: number;   // the seeded `automation` user
const AUTOMATION_NS: string;     // fixed uuid namespace for uuidv5
```

## Related

`items-platform-rebuild` memory · SP2 spec `2026-07-15-items-platform-api-command-path-design.md`
· deferred-followups `2026-07-15-sp2-deferred-followups.md`.
