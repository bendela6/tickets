# Configurable Views — Epic Roadmap

**Date:** 2026-07-08 · **Branch:** `redesign` · **Status:** roadmap (per-epic specs written at build time)

> This is the **roadmap**, not an implementation plan. Each epic below becomes its own
> spec (`brainstorming` → `writing-plans`) when we pick it up. Tasks are sized to **~1 PR**
> to match the project rule *Task = one PR*.

## Goal

Make **every element that renders on a board view user-configurable at runtime**. Today the
rendering engine is genuinely schema-driven (one `/api/projects/:key/board` payload), but a
layer of hardcoding sits on top: regex-guessed card fields, a fixed 5-kind KPI strip,
status-only kanban grouping, fixed non-field columns, single-level sort, and conventional
field keys assumed by string literal in ~15 files.

## Locked decisions (from brainstorming)

- **Who / where:** any end-user edits **shared, per-project views** at runtime. No per-user
  ownership (no real auth — "current user" is a local identity picker).
- **Nature:** configurability architecture + a view-builder UX. **Keep the Instrument look.**
- **Breadth:** make existing surfaces (table, board, KPIs, cards, ticket detail, all-tickets)
  fully configurable **+ two new modes: Calendar and Timeline/Gantt**.
- **Schema vs view:** admins shape the schema (types/fields/links) separately (Epic E0);
  end-users compose views over it (E1–E7).

## Core principle

> Everything renders from the view's `config`, and every choice is picked from the board
> schema (fields / options / statuses). No regex heuristics, no hardcoded columns/KPIs/keys.

## Locked decisions (2026-07-08 interactive Q&A)

**Process & tracking**
- Sequence: **E1 (spine) now, E0 in parallel**; E1 blocks E2–E6.
- Execution: **subagent-driven** (implementer + reviewer per task), tracked as tickets.
- Tracker: create in **tickets / TIX** — **Epics + Tasks now, Subtasks at each epic's kickoff**.

**Config model**
- Filters: **AND-of-OR groups** (one nesting level).
- Table grouping: **single-level** (nested = future).
- Aggregations: **counts + numeric sum/avg** in group headers/column footers.
- Group-by / column / date eligibility: **per-field capability flags** set in the field editor
  (type-based defaults, admin-overridable) — never inferred or hardcoded.
- Card layout: **one template per view**.
- KPIs: **count / % + numeric sum/avg**, user-defined; default preset = the 5 status kinds.
- Degraded views: **drop the dead reference + show a notice**.
- View governance: **open editing; the default view is archive-only (undeletable)**.
- Global "All tickets" views: **server-side, cross-project scope** (promote off localStorage).

**Schema admin (E0)**
- Scope: **per-type fields + options + link types (+allowed targets) + capability flags**;
  types & statuses stay seed-managed.
- Field **key + type immutable** after creation (label/widget/options/required/flags editable).

**Modes**
- Calendar: **single-date placement + drag-to-reschedule**; Month/Week; mobile agenda.
- Timeline: **editable bars** (drag/resize start–end); dependency = **visual hint only**; week/month zoom.

**Settled by the design canvas**
- **Draft → "Save to view"** editing model (not live-mutate).
- **One view flips modes** (`mode` + `modeConfig`).
- Swimlanes include **WIP limits**.

**Scope deltas from these answers**
- E0 gains a task: **field capability flags** (groupable / calendar-date / timeline start-end eligible).
- E1 gains: **builder reads capability flags** for picker eligibility; **AND-of-OR** filter model; rollups.
- E7-T2 resolved: **global views → server-side, cross-project scope**.

---

## Epic map & sequencing

```
        ┌─────────────────────────────┐
        │ E0  Schema Admin (per-type)  │  ← independent, run in parallel any time
        └─────────────────────────────┘

        ┌─────────────────────────────┐
        │ E1  View Config Foundation   │  ← the spine; blocks E2–E6
        └───────────────┬─────────────┘
                        │
        ┌───────────────┼───────────────────────────┐
        ▼               ▼                           ▼
  ┌───────────┐   ┌───────────┐              ┌───────────────┐
  │ E2 Table  │   │ E3 Board  │              │ E4 KPIs       │
  └─────┬─────┘   └─────┬─────┘              └───────────────┘
        │               │
        │               └──────────────┐
        ▼                              ▼
  ┌───────────────┐            ┌───────────────────┐
  │ E7 All-Tickets│            │ E5 Calendar       │  (reuses E3 card model)
  │  + cleanup    │            └───────────────────┘
  └───────────────┘            ┌───────────────────┐
                               │ E6 Timeline/Gantt │  (reuses E2/E3 grouping)
                               └───────────────────┘
```

**Suggested order:** E0 (parallel) · **E1 first** · then E2 / E3 / E4 (parallelizable) ·
then E5 / E6 · E7 last (needs E2's grouping).

| Epic | Title | Tasks | Depends on |
|------|-------|:----:|------------|
| **E0** | Schema Admin — per-type fields & links | 5 | — (parallel) |
| **E1** | View Config Foundation (the spine) | 4 | — |
| **E2** | Configurable Table | 5 | E1 |
| **E3** | Configurable Board (kanban) | 4 | E1 |
| **E4** | Configurable KPIs | 3 | E1 |
| **E5** | Calendar Mode | 4 | E1, E3 |
| **E6** | Timeline / Gantt Mode | 4 | E1, E2 |
| **E7** | All-Tickets parity + de-hardcoding cleanup | 4 | E1, E2 |

Total: **8 epics · ~33 PR-sized tasks.**

---

## E0 — Schema Admin: per-type fields & links

**Goal:** make the settings/admin surface actually manage the type-owned schema, so "admins
shape the schema separately" is real. **Value:** unblocks all configuration; fixes 2 live 404s.
**Depends on:** nothing (parallel track). **Out of scope:** end-user view config (E1+).

| Task | Deliverable | Key files |
|------|-------------|-----------|
| E0-T1 | Rewire create-field to `POST /api/types/:typeId/fields`; FieldsSettings gains a **type picker** (which type owns the field) | `apps/web/src/api/use-vocab-fields.ts`, `components/settings/fields-settings.tsx` (+ test) |
| E0-T2 | Rewire create-link-type to `POST /api/types/:typeId/link-types` with `targetTypeKeys[]`; add **source-type + allowed-targets** pickers | `apps/web/src/api/use-create-link-type.ts`, `components/settings/link-types-settings.tsx` |
| E0-T3 | Make TypesSettings **editable**: per-type ordered field list — reorder (position), toggle `required`, pick widget; add the API endpoint if missing | `components/settings/types-settings.tsx`, `apps/api/src/routes/vocabulary.routes.ts` |
| E0-T4 | Per-type-field **options** management parity (create/patch/reorder/archive) | `fields-settings.tsx`, options routes |
| E0-T5 | Harden `create-field` unknown `typeId` → **400** (not 500); align error shape with link path | `apps/api/src/vocab/create-field.ts` (+ test) |

**Verify:** create a field on Bug only → appears on Bug tickets, not Task; create a Task→Bug
link type → link Task↔Bug works, Task↔Epic rejected (422).

---

## E1 — View Config Foundation (the spine)

**Goal:** grow the view-config model + server validation + web normalization to express every
renderable, with **backward-compatible defaults so nothing visibly changes yet.** **Value:**
one model everything else builds on. **Depends on:** nothing. **Blocks:** E2–E6.

**Config shape (target):**
```ts
type ViewConfig = {
  columns: ViewColumn[];              // meta (number|type|progress) + field, each { width?, hidden? }
  grouping: { fieldKey: string; collapsed?: string[] } | null;
  swimlane: { fieldKey: string } | null;      // board secondary grouping
  sort: ViewSort[];                   // multi-level (was single)
  filters: { groups: FilterGroup[] }; // AND/OR groups (was flat rules)
  cardLayout: { fields: CardField[] } | null; // { fieldKey, render: 'chip'|'badge'|'text'|'avatar'|'progress' }
  kpis: KpiDef[] | null;              // null → default 5-kind preset
  mode: 'table' | 'board' | 'calendar' | 'timeline';
  modeConfig: {
    calendar?: { dateFieldKey: string; chipFields: string[] };
    timeline?: { startFieldKey: string; endFieldKey: string; rowGroupKey?: string; zoom: 'week'|'month' };
  };
  density: 'comfortable' | 'compact';
};
```

| Task | Deliverable | Key files |
|------|-------------|-----------|
| E1-T1 | Extend `ViewConfig` type + `normalizeViewConfig` with back-compat: old single `sort` → `sort[0]`; `kpi:boolean` → preset/hidden; flat `filters.rules` → one group; missing keys default to current behavior | `apps/web/src/utils/view-config.ts` (+ test) |
| E1-T2 | Server-side validation of every field reference (group-by, each sort key, card fields, KPI fields, calendar `dateFieldKey`, timeline start/end) against `vocab.fieldKeys`; validate op/render enums | `apps/api/src/views/validate-view-config.ts` (+ test) |
| E1-T3 | Board payload exposes per-logical-field **eligibility** (`type` already there → derive date-eligible / groupable / option-bearing) so the builder can filter pickers | `apps/api/src/boards/logical-fields.ts`, `routes/projects.routes.ts` |
| E1-T4 | Persistence handles the richer config (debounced PATCH, optimistic) | `apps/web/src/state/use-view-config.ts` |

**Verify:** existing saved views render **identically**; new config round-trips through PATCH +
reload; invalid field refs rejected 4xx.

---

## E2 — Configurable Table

**Goal:** the table honors the extended config — data-driven columns, widths, grouping,
multi-sort — with the builder controls to edit them. **Depends on:** E1.

| Task | Deliverable | Key files |
|------|-------------|-----------|
| E2-T1 | Render **meta columns** (number/type/progress) from `columns[]` — toggleable/reorderable alongside field columns; unify header labels | `components/board/table-view.tsx`, `board-header.tsx` |
| E2-T2 | **Columns manager** popover: show/hide checklist + drag reorder + "＋ Add column" (lists available fields); writes config | `board-header.tsx` (`ColumnChecklist`) |
| E2-T3 | **Resizable columns**: drag handles + width readout; persist `width` per column | `table-view.tsx`, `view-config.ts` |
| E2-T4 | **Multi-level sort**: `compareTickets` honors `sort[]`; Sort popover add/remove/reorder; header click cycles primary | `utils/compare-tickets.ts`, `board-header.tsx` |
| E2-T5 | **Grouped table**: group-by any field; collapsible group headers with counts + rollup; Group-by control | `table-view.tsx`, `board-header.tsx` |

**Verify:** group by assignee → grouped rows w/ counts; reorder + resize columns persist across
reload; sort by Priority ↑ then Due ↑.

---

## E3 — Configurable Board (kanban)

**Goal:** kanban grouped by any field, optional swimlanes, and **declared** card fields
(kill the regex heuristics). **Depends on:** E1. **Shared by:** E5 (card model).

| Task | Deliverable | Key files |
|------|-------------|-----------|
| E3-T1 | Group kanban **columns by any select/status field** (not only status). Grouped by status → keep workflow-legal DnD; grouped by another field → drop **sets that field value** | `components/kanban-view.tsx`, `legal-status-targets.ts` |
| E3-T2 | **Swimlanes**: secondary grouping → horizontal lanes with header + count | `kanban-view.tsx` |
| E3-T3 | **Declared card layout** rendering — replace `/prio|assignee|due/` regex with configured fields/order/render-as | `kanban-view.tsx` |
| E3-T4 | **Card-layout editor** popover (pick fields, order, render: chip/badge/text/avatar/progress) | `board-header.tsx` or new `card-layout-editor.tsx` |

**Verify:** group board by Priority; add Assignee swimlanes; a card shows exactly the configured
fields (no regex guess).

---

## E4 — Configurable KPIs

**Goal:** replace the fixed 5-kind KPI strip with user-defined metrics. **Depends on:** E1.

| Task | Deliverable | Key files |
|------|-------------|-----------|
| E4-T1 | **KPI definition + evaluator**: count/% of tickets where `<field> <op> <value>`, optional "group by field option" | new `utils/evaluate-kpis.ts` (+ test) |
| E4-T2 | KPI strip renders from definitions; **default preset = the 5 status kinds** (back-compat for `kpi:true`) | `components/board/kpi-strip.tsx` |
| E4-T3 | **KPI editor** (add/edit/remove); generalize "done %" off hardcoded `kind==='done'` | `kpi-strip.tsx`, `components/board-screen.tsx` |

**Verify:** add "P0+P1 open" KPI → strip updates; old views still show the 5-kind default.

---

## E5 — Calendar Mode

**Goal:** a new renderer placing tickets on a month/week grid by a chosen date field.
**Depends on:** E1 (+ reuses E3 card/chip model).

| Task | Deliverable | Key files |
|------|-------------|-----------|
| E5-T1 | Mode switch adds **Calendar**; `modeConfig.calendar = { dateFieldKey, chipFields }`; eligible **date-field picker** | `board-header.tsx`, `view-route.tsx` |
| E5-T2 | Month/week **grid renderer** placing tickets by `dateFieldKey`; "+N more" overflow; no-date bucket | new `components/calendar-view.tsx` |
| E5-T3 | Day-cell **chips** render configured fields (reuse card model); click → peek/detail; reuse filters + KPIs | `calendar-view.tsx` |
| E5-T4 | **Mobile** agenda-list variant | `calendar-view.tsx` |

**Verify:** switch to Calendar by Due → tickets land on correct days; change date field re-lays-out.

---

## E6 — Timeline / Gantt Mode

**Goal:** a horizontal time-axis renderer with bars from a start field to an end field, rows
grouped by a chosen field. **Depends on:** E1 (+ E2 grouping model).

| Task | Deliverable | Key files |
|------|-------------|-----------|
| E6-T1 | Mode switch adds **Timeline**; `modeConfig.timeline = { startFieldKey, endFieldKey, rowGroupKey, zoom }` | `board-header.tsx`, `view-route.tsx` |
| E6-T2 | **Time-axis + bar renderer** (start→end), zoom (week/month), today-line | new `components/timeline-view.tsx` |
| E6-T3 | **Row grouping** (collapsible) reusing grouping model; bar color by status kind or chosen field | `timeline-view.tsx` |
| E6-T4 | **Dependency hints** for blocking links — resolved by link **semantics**, not literal `'blocks'` | `timeline-view.tsx`, `detail-links.tsx` |

**Verify:** timeline of Epics by start→due grouped by Assignee; today-line correct; missing-date
handled.

---

## E7 — All-Tickets parity + de-hardcoding cleanup

**Goal:** bring the cross-project screen to the same builder and remove the conventional-key
hazards. **Depends on:** E1, E2.

| Task | Deliverable | Key files |
|------|-------------|-----------|
| E7-T1 | All-tickets uses the **same builder** (group-by any shared field, configurable columns, shared filter/sort popovers); fold `shared-fields.ts` heuristics into config | `components/all-tickets/*`, `shared-fields.ts` |
| E7-T2 | **Global-views persistence** decision — move localStorage global views to server `views` with a cross-project scope (recommend a nullable/`global` scope) *(open decision below)* | `components/all-tickets/global-views.ts`, `packages/db/src/schema/views.ts` |
| E7-T3 | **Robust conventional keys** — ticket-detail title/description via robust fallback (not literal `'title'`/`'description'`); blocked-link color by link semantics; subtask type discovery robust | `components/ticket-detail.tsx`, `detail-fields.tsx`, `detail-links.tsx`, `new-ticket-dialog.tsx` |
| E7-T4 | Remove dead regex heuristics + stale tests; handle legacy `?f=` URL filters | `kanban-view.tsx`, `shared-fields.ts`, `view-route.tsx` |

**Verify:** all-tickets grouped by any field; a project whose rich-text field isn't named
`description` still shows its description section.

---

## Cross-cutting risks

- **Kanban DnD semantics** (E3-T1): dropping a card means *set status* only when grouped by
  status; for other groupings it must set the grouped field's value — and be a no-op for
  ungroupable columns. Get this contract right once.
- **Back-compat** (E1-T1): every existing stored view must normalize without user-visible change.
  This is the highest-regression-risk task; lead with tests on real stored configs.
- **Field eligibility** (E1-T3): calendar/timeline need date fields; group-by/KPI need
  option-bearing fields. Surface eligibility from the board so pickers can't offer invalid fields.
- **Sort stability across types** (E2-T4/E3): shared select columns order by option `position`;
  per-type option lists must stay aligned (already true from the type-owned seed).

## Open decisions (resolve at epic kickoff)

1. **Global-views persistence (E7-T2):** keep localStorage, or promote to server-side `views`
   with a cross-project scope? *Recommendation: server-side, nullable project scope.*
2. **Field roles depth (E7-T3):** minimal robust-fallback for title/description now, or a
   first-class `role` on fields (admin-declared)? *Recommendation: minimal now; roles later if pain persists.*
3. **New modes as separate `views` rows or `mode` on one view?** *Recommendation: `mode` +
   `modeConfig` on a single view (already the model), so one saved view can flip renderers.*
