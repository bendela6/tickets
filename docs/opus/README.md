# Event Sourcing — Design Set

> **⚠️ SUPERSEDED (2026-07-14)** — the plan of record is
> [`docs/superpowers/specs/2026-07-14-items-platform-schema-and-import-design.md`](../superpowers/specs/2026-07-14-items-platform-schema-and-import-design.md),
> which builds to [`apps/eer/models/items-platform.json`](../../apps/eer/models/items-platform.json).
> This tree is kept for its **DDL and its runtime design**, which the spec cites and reuses:
> the `events` / `commands` / `outbox` tables ([`2-schema.md`](2-schema.md)), the hardened
> EAV constraints, the registry and command path ([`3-runtime.md`](3-runtime.md)).
> Where it disagrees with the model, the **model wins** — notably it keeps the `ticket*`
> noun, puts options under a field with transitions in jsonb, and places the `imported`
> baseline event at `seq = 1` (which would break replay).

_Consolidated, decided design for event-sourcing the ticket aggregate. Five files, layered — read in
order. Shapes live in exactly one place; every other file links, never restates._

## Goal

> Evolve `tickets` from **CRUD + audit** into a **lossless, typed, consumable event log** for the
> ticket aggregate — powering the activity feed, automations, and webhooks now (Tier A), with an
> optional, un-forced path to full event-sourcing later (Tier B). Ship in phases: **no rewrite, no
> second bus.**

## Reading order

| # | File | Owns |
| --- | --- | --- |
| 0 | **README.md** (this) | goal, scope, tiers, decisions |
| 1 | [`1-events.md`](1-events.md) | the log — envelope, kinds, value types, payloads, **registry** |
| 2 | [`2-schema.md`](2-schema.md) | the tables |
| 3 | [`3-runtime.md`](3-runtime.md) | write path, projections, consumers, ops |
| 4 | [`4-migration-plan.md`](4-migration-plan.md) | phased rollout |
| — | [`../../apps/eer`](../../apps/eer) | interactive EER diagram of this schema |

## EER viewer

An interactive entity–relationship viewer for this schema lives in
[`apps/eer`](../../apps/eer) (`pnpm --filter @tickets/eer dev` →
http://localhost:4630). It is **entirely JSON-driven** — the diagram is built
from [`eer-model.json`](eer-model.json); the renderer hardcodes no entities,
fields, or edges. Point it at another model with `?model=<url>`.

**Author a model** — edit `eer-model.json` (or a copy) and reload. The full format,
validation rules, and cardinality inference are documented in
[`eer-schema.md`](eer-schema.md). In short:

- add an **entity** → a `{ id, label, group, fields[] }` object in `entities`;
- add a **field** → a `{ name, type, role? , ref?, refField? }` object in that entity's `fields`;
- add a **relationship** → a `{ source, sourceField, target, targetField, cardinality?, kind? }` object in `relationships`.

Broken references (an entity in an unknown group, an edge to a missing field, …)
surface as a visible error banner rather than a silent blank diagram.

## Scope

- 🎯 **Event-source the ticket aggregate** — the log is (eventually) the source of truth for a ticket's state.
- 🗃️ **Config / vocab** (fields, options, schemes) — a *separate* **audit** stream; those tables stay authoritative.
- 🚫 **Views / users / projects** — CRUD, no events.
- 🚌 **One bus** — the outbox that drives projections also drives automations + webhooks. No second dispatcher.

## Tiers

| Tier | Name | Source of truth | Events do | Value |
| --- | --- | --- | --- | --- |
| **0** | Lossless audit | current tables | record raw facts (ids, not labels) | honest history; rebuildable later |
| **A** | Event-driven | current tables | + outbox + consumers after commit | activity feed, automations, webhooks |
| **B** | Ticket event-sourced | the `events` log | write event → project state | temporal queries, rebuild, compliance |

**Default target: 0 → A.** Gate **B** on a concrete driver (regulatory replay, "state as of X", multi-projection rebuild). Each tier is a strict superset — no dead ends.

## Current state / why

The hard part is already done: every mutation writes an event **in the same transaction** as the state
change ([`write-event.ts`](../../apps/api/src/events/write-event.ts)). The gaps: payloads are **lossy**
(rendered strings, not raw ids), `kind` is **free-text**, and **nothing consumes** the events. We close
those.

## Decisions

| Decision | Status |
| --- | --- |
| Ticket aggregate only; config = audit; views/users = CRUD | ✅ |
| `field.changed`, one event per field; payload = new **`value`** only (no `before`) | ✅ |
| Slim `fields` enum (8) + formats/cardinality in `config` | ✅ |
| Seven value types + `json` escape hatch | ✅ |
| Idempotency via a `commands` ledger (not a unique on the event) | ✅ |
| `commandId` (trace) + `correlationId` (grouping, default = commandId) + `causedBy`/`depth` | ✅ |
| `number` as string in payload; `date` as ISO 8601 | ✅ |
| One self-registering entry per kind (`defineEvent` + `register`); **valibot schema on the def** | ✅ |
| **No separate status** — a workflow status is an `option` field (no `statuses` table / `status_id` / `status` type) | ✅ |
| **Flip source of truth to the log (Tier B)** | 🟡 gated — needs a driver |
| Config audit-stream kinds | 🟡 open |

## Non-goals

- **Event-source everything** — the ticket feed fragments across streams and you lose cross-aggregate FK integrity.
- **A plural `fields.changed` event** — splits every consumer; multi-field = N events + `correlationId`.
- **Rich field *types*** (`url`, `email`, `rich_text`) — they differ only in validation/rendering, so they live in `config`.

## Success metrics

| Metric | Target |
| --- | --- |
| Write latency | event append + projection in the same txn; p99 ≤ ~1.15× today |
| Feed read | ticket activity = **one indexed query**, no payload scans |
| Delivery | at-least-once; zero lost events after commit |
| Rebuild (Tier B) | `ticket_values` rebuildable from the stream alone |
| Expand | add a kind without downtime / schema freeze |

**Verify by measurement**, not assertion — every phase exits on a measured check (below and in
[`4-migration-plan.md`](4-migration-plan.md)), including a rebuild-and-diff at Tier B.
