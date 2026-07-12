# Events — delivery phases (greenfield)

Not a migration from old `ticket_events`. Build order on empty DB / redesign branch.

| Phase | Deliverable | Stop? |
| ----- | ----------- | ----- |
| **E0** | Schema: events, commands, outbox, item_activity, hardened item_values | |
| **E1** | Event registry + all `item.*` defs; command path emits lossless events | |
| **E2** | Outbox worker + activity UI + one automation consumer | **default stop (Tier A)** |
| **E3** | Audit streams for structure (field/type attach, …) as needed | |
| **E4** | Tier B: event-first + snapshots + rebuild-diff | **gated** |
| **E5** | PII crypto-shred + retention/partition | later |

**Depends on** platform Slice 0–1 (items exist) and fields model.

Gates: PATCH p99 ≤ ~1.15× baseline after E1–E2; outbox lag p99 &lt; 2s; activity list indexed.
