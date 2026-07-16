# SP2 — Deferred follow-ups (inputs to SP3/SP4)

SP2 (API command-path port) is complete and merged into `items-platform`. The final
whole-branch review deferred the items below — none are data-integrity bugs in
committed code, and `apps/api` does not run in production until the SP4 cutover, so
"defer" is legitimate. Fold each into the relevant sub-project's spec.

## Behavior regressions vs the legacy API (link + view) — SP4 (or a link-parity follow-up)

- **R1 — cross-project links not rejected.** `item.link` (`apps/api/src/command/item/link.ts`) no longer checks `source.projectId === target.projectId`; the old route returned 422. Two items in different projects can be linked.
- **R2 — directional link cycles not detected.** The old `check-link-cycle.ts` (deleted as orphaned) prevented `A blocks B blocks A`. `item.link` no longer detects cycles.
- **R3 — duplicate link returns 500, not 409.** A duplicate `(link_type, source, target)` hits the `item_links_unique` constraint → raw 23505 propagates (the runCommand catch only maps `commands_pkey`). The old route returned a clean 409. Data is still protected by the unique constraint.
- **R4 — view config not validated.** `view.create`/`view.update` (`command/config/view.ts`) no longer validate `config` against the scheme's field keys; the old `validate-view-config.ts` (deleted as orphaned) did.

## Error-mapping / concurrency — SP3

- **N3 — event-stream seq collision surfaces as 500, not the spec'd 409-with-retry.** A concurrent `item.comment`/`item.link` on the same item stream can collide on `unique(aggregate_type, aggregate_id, seq)`; that 23505 isn't `commands_pkey`, and there is no retry loop. (`item.update` is protected by `lockItem`.) Add a bounded serialization-retry in `runCommand`, or map the stream-unique violation to 409.

## Value-path hardening + coverage — SP3

- **M1 — `buildValueRows` number validation misses `Number.isFinite`.** `Infinity`/`-Infinity` pass and reach the `numeric` column as an opaque DB error instead of a clean 400.
- **M2 — date/datetime accepts any `Date.parse`-able string,** not strict ISO (`"July 4, 2026"`, `"2026"` slip through).
- **N4 — `item.field_changed.from` renders scalar-vs-array inconsistently** for a single-valued multi field; a multi array with duplicate option values → unmapped 23505 → 500.
- **C1 — value round-trip coverage gap:** only `string` + single `option` are round-tripped; `number`/`boolean`/`date`/`datetime`/`json`/`user`/multi-option build+render paths are untested. (SP1's final review closed exactly this class of gap — worth doing.)
- **C2 — transition/guard reject paths unexercised:** the seed has zero `option_transitions`, so `checkTransition`'s reject path and `runTransitionGuard` are untested. Add a test that seeds transitions via `transition.create`, then asserts a disallowed move 422s and a guard blocks.
- **C3 — `field.create` 400 branches untested** (missing `optionSetId`, unknown item type).

## Read determinism + minor — SP3/anytime

- **M3 — `item.update` workflow no-op still writes + emits.** Setting the workflow field to its current value skips the transition check but still delete+reinserts the value row and emits `item.field_changed` with `from === to`. The old `patchTicket` did `continue` on a status no-op. Skip the write+emit when a field value is unchanged.
- **M4 — `assemble-items` has no `ORDER BY`,** so a multi-value field's array element order is nondeterministic. Add `orderBy(itemValues.id)`.
- **M5 — `runCommand` handler returning `undefined`** is an unexercised edge (no current command does it).
- **M6 — `test/db.ts` `TABLES` list is hand-maintained;** could derive from `@tickets/db`'s `allTables` so a future table isn't silently skipped by `resetDb`. The "child-first" comment is misleading (CASCADE makes order irrelevant).
