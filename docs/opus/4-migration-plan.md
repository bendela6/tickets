# Layer 4 — Migration Plan

_Phased rollout from today's `ticket_events` (lossy audit) to the event platform. Each phase ships
alone and is never wasted; **default stop is end of P2**. Design → layers [1](1-events.md)–[3](3-runtime.md)._

---

## Principles

1. **Forward-only compat** — old readers keep working via the `ticket_events` view / API adapters.
2. **Lossless before invert** — never flip the source of truth (P5) until rebuild is proven.
3. **Small PRs** — one phase ≈ one deployable slice.
4. **Measure** — write latency, feed latency, outbox lag; gates below.
5. **No big-bang ES** — Tier B is last and gated.

---

## Phase map

```
P0  EAV integrity fix              (standalone hardening — not gated on ES)
P1  Typed log + commands + registry (status is a native option field)
P2  Outbox + activity + consumers   ← Tier A finish · DEFAULT STOP
P3  User fields (value_user_id)
P4  Finalize generic events         (if P1 was in-place)
P5  Tier B: SoT flip + snapshots + rebuild CI   ← gated on a driver
P6  Config audit + PII + retention
```

Dependencies: `P0` independent · `P1 → P2` · `P3` independent of the bus (needs P0) · `P4` after P1 ·
`P5` needs P1–P2 + proven rebuild · `P6` after the bus.

---

## P0 — EAV integrity fix  ·  _standalone_

Current-schema hardening, unrelated to ES — ship it first and on its own.

- [ ] `ticket_values`: `num_nonnulls(...) = 1` CHECK; replace the NULL-distinct `unique(ticket_id, field_id, option_id)` with the scalar/option/user **partial uniques** ([schema](2-schema.md#ticket_values--hardened-projection)).

**Exit:** a row with 0 or 2 value columns is rejected by the DB.

---

## P1 — Typed log + commands + registry  ·  _Tier 0 → foundation_

The log becomes **typed + lossless**; tables remain the source of truth.

- [ ] Create `events` + `commands`; migrate `ticket_events` in (or evolve in place, then rename in P4).
- [ ] Rewrite `writeEvent` → the command path: `commandId` idempotency, server `seq`/`correlationId`/`at`, `version`, `causedBy`/`depth`, `projectId`, **`after`-only raw-id payloads**.
- [ ] **Event registry** ([1-events](1-events.md)): `defineEvent({ kind, schema, project?, activity?, upcast? })` per kind, wired via `registry.register(...)`; `v.parse` on write.
- [ ] **Status = option** — model the workflow field as an `option` with `config.transitions` from the start (no separate status concept).
- [ ] **Compat**: `ticket_events` view so existing readers keep working.
- [ ] **Backfill**: one synthetic `imported` event per ticket (`seq = 1`) capturing current `ticket_values`.

**Exit:** every mutation writes a typed, lossless event in-txn; a retried `commandId` is a no-op; the view returns the old shape.

---

## P2 — Outbox + activity + consumers  ·  _Tier A · DEFAULT STOP_

The events finally *drive* things. Stop here unless a Tier B driver appears.

- [ ] `outbox` written in the command txn; single worker (`FOR UPDATE SKIP LOCKED`), idempotent.
- [ ] `ticket_activity` projection ([runtime](3-runtime.md)) — diff computed on fold; group by `correlationId`.
- [ ] First consumers: automation rules + webhooks on the **same bus** (no second dispatcher).

**Exit:** feed renders per-field diffs + multi-field headlines; a real rule fires after restart; a webhook delivers.

---

## P3 — User fields  ·  _optional_

Adds the `user` value type — assignee / watcher fields. (Status needs nothing here — it's a native
`option` field with `config.transitions` from P1.)

- [ ] Add `value_user_id` (+ `user` / multi-user field types) and the board index.

**Exit:** assignee/user fields work; values project to `value_user_id`.

---

## P4 — Finalize generic `events`  ·  _optional_

- [ ] If P1 evolved `ticket_events` in place, rename/copy to `events` with `aggregate_type = 'ticket'`; keep the compat view.

**Exit:** a non-ticket `aggregate_type` can be written with no envelope DDL.

---

## P5 — Tier B: SoT flip  ·  _gated_

Only with a driver (compliance replay, "state as of X", multi-projection rebuild).

- [ ] Event-first write: append → project in one txn ([runtime](3-runtime.md)).
- [ ] `ticket_snapshots` + fold-from-snapshot.
- [ ] **Rebuild-and-diff CI** — rebuild into a scratch DB, diff against live tables.

**Exit:** drop and rebuild `ticket_values` for a project → matches live, byte-for-byte.

---

## P6 — Config audit + PII + retention  ·  _harden_

- [ ] `config` audit stream — emit `config.*` from vocab mutations (audit-only).
- [ ] PII crypto-shredding for comment bodies + PII text.
- [ ] Partition/retain `events` by `project_id` / time.

---

## Backfill policy

| Data | Policy |
| --- | --- |
| Pre-P1 events | display-only; no false rebuild claims |
| `seq` | one-time `ROW_NUMBER()` window backfill |
| Activity | rebuild from events where lossless; else label "unknown before" |
| Tier B baseline | one `imported` (snapshot) event per ticket |

---

## Rollback / verify gates

| Phase | Rollback | Gate |
| --- | --- | --- |
| P0 | drop the CHECK/uniques | bad row rejected |
| P1 | write labels again; columns stay nullable-safe | invalid event can't insert; retry = no-op |
| P2 | stop worker; writes still OK | no-op consumer sees every event under crash test |
| P3 | drop `value_user_id` | assignee/user fields work |
| P5 | feature-flag event-first; don't flip until dual-run matches | rebuild == live |

**Perf gates:** PATCH p99 ≤ 1.15× baseline · outbox lag p99 < 2s · activity list (50) < 50ms.

---

## Stop points / open choices

**Stop at P2** for most cases — a typed, lossless, consumed log (feed + automations + webhooks). Go to
P5 only with a driver.

Lock before PR1: sync vs async `ticket_activity` (default sync) · in-place vs early `events` table ·
kind rename now vs emit-new-map-old · client `commandId` header name · whether P3 precedes P5.
